import settings_env  # noqa: F401 — load repo-root .env before other backend imports

import asyncio
import json
import logging
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import httpx
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from actions import (
    get_action_logs,
    handle_anomalies,
    run_ec2_background_policy_tick,
    run_ec2_optimization,
    run_proactive_ec2_optimization_if_enabled,
    seed_archived_action_logs_once,
)
from anomaly_detection import run_anomaly_detection
from analytics_service import (
    get_anomaly_insights,
    get_cost_allocation,
    get_dashboard_summary,
    get_forecast,
    get_shared_costs,
    get_unit_economics,
)
from aws_cost_fetcher import fetch_cost_data, resolve_time_window
from database import get_db
from models import CostData

SYNTHETIC_COSTS_PATH = Path(__file__).resolve().parent.parent / "synthetic_costs.json"
DEFAULT_ML_DETECT_URL = "https://thixotropic-chanel-infinitesimally.ngrok-free.dev/detect"
DEFAULT_ML_FORECAST_URL = "http://127.0.0.1:8001/forecast"
NGROK_HEADERS = {"ngrok-skip-browser-warning": "true"}
MIN_USABLE_FORECAST_TOTAL = 0.01
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

logger = logging.getLogger(__name__)

app = FastAPI(title="Cloud Cost AI Backend")


def _http_exception_from_aws_error(exc: Exception, *, headline: str) -> HTTPException:
    """
    Map AWS Cost Explorer / boto failures to clearer status codes.

    This avoids returning a generic 500 when the AWS call is denied or quarantined.
    """
    if isinstance(exc, ClientError):
        err = (exc.response.get("Error") or {}) if hasattr(exc, "response") else {}
        code = str(err.get("Code") or "ClientError")
        msg = str(err.get("Message") or exc)
        detail = f"{headline} ({code}): {msg}"

        # Common cases: explicit deny from quarantine, or access denied.
        denied_codes = {"AccessDeniedException", "AccessDenied", "UnauthorizedOperation"}
        msg_l = msg.lower()
        if code in denied_codes or "not authorized" in msg_l or "explicit deny" in msg_l or "quarantine" in msg_l:
            if "compromisedkeyquarantine" in msg_l or "compromisedkeyquarantinev" in msg_l or "quarantine" in msg_l:
                detail += (
                    " — AWS has likely quarantined this access key. "
                    "Rotate IAM access keys and update .env (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY), "
                    "or switch to a non-quarantined IAM user/role."
                )
            return HTTPException(status_code=403, detail=detail)

        return HTTPException(status_code=502, detail=detail)

    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))

    return HTTPException(status_code=502, detail=f"{headline}: {exc}")


async def _ec2_background_policy_loop() -> None:
    await asyncio.sleep(2)
    while True:
        try:
            run_ec2_background_policy_tick()
        except Exception:
            logger.exception("EC2 background policy tick failed")
        try:
            raw = os.getenv("EC2_OPTIMIZATION_POLICY_INTERVAL_SECONDS", "30")
            interval = float(raw)
        except ValueError:
            interval = 30.0
        interval = max(2.0, min(interval, 3600.0))
        await asyncio.sleep(interval)


@app.on_event("startup")
async def _start_ec2_background_worker() -> None:
    asyncio.create_task(_ec2_background_policy_loop())


@app.on_event("startup")
async def _seed_persisted_automation_logs() -> None:
    seed_archived_action_logs_once()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # Vite picks another port when 3000 is in use (e.g. 3001–3002); without this the browser shows "failed to fetch".
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FinOpsAssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    time_frame: Literal["today", "past_one_week", "past_one_month", "past_one_year"] = "past_one_month"
    services: list[str] = Field(default_factory=list)
    force_fallback: bool = False


class Ec2OptimizationRunRequest(BaseModel):
    """Optional overrides; when instance_names is null, Name tag list comes from env."""

    instance_names: list[str] | None = None
    action: Literal["stop", "terminate"] | None = None
    include_explicit_ids: bool = False


def _json_float(value: float | None, *, places: int = 6) -> float | None:
    """Format floats for JSON so tiny values don't appear in scientific notation."""
    if value is None:
        return None
    return float(f"{float(value):.{places}f}")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/debug/env")
def debug_env():
    """Small safety endpoint to verify the server loaded .env in this process."""
    key_id = os.getenv("AWS_ACCESS_KEY_ID") or ""
    return {
        "aws_access_key_id_present": bool(key_id),
        "aws_access_key_id_last4": key_id[-4:] if len(key_id) >= 4 else "",
        "aws_default_region": os.getenv("AWS_DEFAULT_REGION"),
        "enable_chaos_mode": os.getenv("ENABLE_CHAOS_MODE"),
    }


@app.post("/optimization/ec2/run")
def optimization_ec2_run(body: Ec2OptimizationRunRequest = Ec2OptimizationRunRequest()):
    """Run EC2 stop/terminate now. Targets: EC2_INSTANCE_ID (if include_explicit_ids) plus Name tags from body or env."""
    taken = run_ec2_optimization(
        "manual_api_trigger",
        include_explicit_ids=body.include_explicit_ids,
        instance_names=body.instance_names,
        action=body.action,
        silent_if_no_targets=False,
    )
    return {"ok": True, "actions_taken": taken, "recent_logs": get_action_logs()[:25]}


@app.post("/chaos/start")
async def chaos_start():
    """Controlled demo: one t3.micro with tag chaos-test, then terminate. Requires ENABLE_CHAOS_MODE=true."""
    from chaos import is_chaos_mode_enabled, start_chaos_mode

    if not is_chaos_mode_enabled():
        raise HTTPException(
            status_code=403,
            detail="Chaos mode is disabled. Set ENABLE_CHAOS_MODE=true in the environment.",
        )
    return await start_chaos_mode()


@app.post("/chaos/stop")
async def chaos_stop():
    """Cancel in-flight chaos workflow and terminate tracked instances."""
    from chaos import stop_chaos_mode

    return await stop_chaos_mode()


@app.on_event("startup")
async def _chaos_stale_cleanup_on_startup() -> None:
    from chaos import cleanup_stale_chaos_runs

    await asyncio.to_thread(cleanup_stale_chaos_runs)


def insert_cost_records(db: Session, records: list[dict]) -> int:
    """Insert rows with duplicate skip on (date, service)."""
    dates_in_file = {date.fromisoformat(r["date"]) for r in records if r.get("date")}
    existing_pairs = set()
    if dates_in_file:
        rows = db.execute(
            select(CostData.date, CostData.service).where(CostData.date.in_(dates_in_file))
        ).all()
        existing_pairs = {(r[0], r[1]) for r in rows}

    seen_in_file: set[tuple[date, str | None]] = set()
    created = 0

    for rec in records:
        item_date = date.fromisoformat(rec["date"])
        svc = rec.get("service")
        key = (item_date, svc)

        if key in existing_pairs or key in seen_in_file:
            continue

        row = CostData(
            date=item_date,
            amount=float(rec["amount"]),
            service=svc,
        )
        db.add(row)
        seen_in_file.add(key)
        created += 1

    db.commit()
    return created


def insert_synthetic_data(db: Session) -> int:
    if not SYNTHETIC_COSTS_PATH.is_file():
        raise FileNotFoundError(str(SYNTHETIC_COSTS_PATH))

    with open(SYNTHETIC_COSTS_PATH, encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        raise ValueError("synthetic_costs.json must be a JSON array")

    return insert_cost_records(db, records)


def load_synthetic_records() -> list[dict]:
    if not SYNTHETIC_COSTS_PATH.is_file():
        raise FileNotFoundError(str(SYNTHETIC_COSTS_PATH))
    with open(SYNTHETIC_COSTS_PATH, encoding="utf-8") as f:
        records = json.load(f)
    if not isinstance(records, list):
        raise ValueError("synthetic_costs.json must be a JSON array")
    return records


def ml_detect_url() -> str:
    return os.getenv("ML_DETECT_URL") or os.getenv("ML_ANOMALY_DETECT_URL") or DEFAULT_ML_DETECT_URL


def ml_forecast_url() -> str:
    return os.getenv("ML_FORECAST_URL") or DEFAULT_ML_FORECAST_URL


def groq_api_key() -> str:
    return os.getenv("GROQ_API_KEY", "").strip()


def groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()


def has_usable_costs(records: list[dict]) -> bool:
    if not records:
        return False
    total_cost = sum(abs(float(record.get("amount", 0.0))) for record in records)
    return total_cost >= MIN_USABLE_FORECAST_TOTAL


def load_synthetic_cost_data(
    *,
    time_frame: str,
    services: list[str] | None = None,
) -> dict:
    records = load_synthetic_records()
    start_date, end_date = resolve_time_window(time_frame)
    start_day = date.fromisoformat(start_date)
    end_day = date.fromisoformat(end_date)
    selected_services = {service for service in (services or []) if service}
    source_records = [
        record
        for record in records
        if not selected_services or record.get("service") in selected_services
    ]
    applied_services = sorted(selected_services)

    if not source_records:
        source_records = records
        applied_services = []

    unique_source_days = sorted({date.fromisoformat(str(record["date"])) for record in source_records if record.get("date")})
    window_days = max((end_day - start_day).days, 14)
    source_days = unique_source_days[-window_days:] if len(unique_source_days) > window_days else unique_source_days

    if not source_days:
        raise ValueError("Synthetic dataset does not contain any usable rows.")

    target_start_day = end_day - timedelta(days=len(source_days))
    day_offsets = {
        source_day: target_start_day + timedelta(days=index)
        for index, source_day in enumerate(source_days)
    }

    filtered_records = []
    for record in source_records:
        source_day = date.fromisoformat(str(record["date"]))
        target_day = day_offsets.get(source_day)
        if target_day is None:
            continue
        filtered_records.append(
            {
                "date": target_day.isoformat(),
                "service": record.get("service"),
                "amount": float(record.get("amount", 0.0)),
            }
        )

    available_services = sorted({str(record.get("service")) for record in filtered_records if record.get("service")})

    return {
        "request": {
            "source": "synthetic_fallback",
            "time_frame": time_frame,
            "services": applied_services,
            "history_window_days": len(source_days),
        },
        "raw_response": {
            "source": "synthetic_fallback",
            "record_count": len(filtered_records),
            "applied_services": applied_services,
        },
        "records": filtered_records,
        "available_services": available_services,
        "selected_services": applied_services,
        "time_frame": time_frame,
        "start_date": target_start_day.isoformat(),
        "end_date": end_date,
    }


def get_cost_data_with_fallback(
    *,
    time_frame: str,
    services: list[str] | None = None,
    force_fallback: bool = False,
    strict_aws: bool = False,
) -> tuple[dict, str]:
    if force_fallback:
        try:
            cost_data = load_synthetic_cost_data(time_frame=time_frame, services=services or [])
        except (FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=404, detail=str(e))
        return cost_data, "synthetic_fallback"

    data_source = "aws"
    try:
        cost_data = fetch_cost_data(time_frame=time_frame, services=services or [])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("AWS history fetch failed")
        try:
            raise _http_exception_from_aws_error(e, headline="Unable to load AWS cost history") from e
        except HTTPException:
            raise
        except Exception as map_err:
            # If the mapper itself errors, still return a JSON response.
            raise HTTPException(
                status_code=500,
                detail=f"AWS cost history fetch failed, and error mapping failed: {map_err}",
            ) from map_err

    if strict_aws:
        return cost_data, "aws"

    if not has_usable_costs(cost_data["records"]):
        logger.info("AWS returned no usable forecast data; falling back to synthetic dataset")
        try:
            cost_data = load_synthetic_cost_data(time_frame=time_frame, services=services or [])
        except (FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=404, detail=str(e))
        data_source = "synthetic_fallback"

    return cost_data, data_source


def transform_ml_anomalies(ml_results: list[dict]) -> list[dict]:
    """
    Transform ML service results into action handler format.
    
    ML returns: [{"date": "...", "service": "EC2", "amount": 100, "anomaly": true, "score": -0.5}]
    Action handler expects: [{"service": "EC2", "severity": "high"}]
    
    Severity mapping based on anomaly score:
    - score < -0.3: high
    - score < 0: medium
    - score >= 0: low
    """
    transformed = []
    for result in ml_results:
        # Only process actual anomalies
        if not result.get("anomaly"):
            continue
        
        score = result.get("score", 0)
        service = result.get("service", "Unknown")
        
        # Map score to severity
        if score < -0.3:
            severity = "high"
        elif score < 0:
            severity = "medium"
        else:
            severity = "low"
        
        transformed.append({
            "service": service,
            "severity": severity,
            "score": score,
            "date": result.get("date"),
            "amount": result.get("amount")
        })
    
    return transformed


def build_finops_summary(records: list[dict]) -> dict:
    service_totals: dict[str, float] = {}
    daily_totals: dict[str, float] = {}

    for record in records:
        service_name = str(record.get("service") or "Unassigned")
        amount = float(record.get("amount", 0.0))
        record_date = str(record.get("date"))
        service_totals[service_name] = service_totals.get(service_name, 0.0) + amount
        daily_totals[record_date] = daily_totals.get(record_date, 0.0) + amount

    total_cost = sum(service_totals.values())
    top_services = sorted(service_totals.items(), key=lambda item: item[1], reverse=True)[:6]
    peak_day = max(daily_totals.items(), key=lambda item: item[1]) if daily_totals else (None, 0.0)
    average_daily_cost = total_cost / max(len(daily_totals), 1)

    return {
        "total_cost": _json_float(total_cost),
        "average_daily_cost": _json_float(average_daily_cost),
        "peak_day": peak_day[0],
        "peak_day_cost": _json_float(peak_day[1]),
        "total_records": len(records),
        "top_services": [
            {
                "service": service,
                "total_cost": _json_float(amount),
                "share": _json_float((amount / total_cost) if total_cost else 0.0, places=4),
            }
            for service, amount in top_services
        ],
    }


def build_local_finops_answer(
    *,
    question: str,
    time_frame: str,
    data_source: str,
    summary: dict,
) -> str:
    normalized_question = question.strip().lower()
    greeting_tokens = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}
    if normalized_question in greeting_tokens:
        source_text = "synthetic fallback dataset" if data_source == "synthetic_fallback" else "AWS Cost Explorer data"
        return (
            f"Hi, I'm CloudGuard. I'm connected to your {source_text} for {time_frame} "
            "and I can help with cloud spend, service trends, anomalies, and savings ideas."
        )

    top_services = summary.get("top_services", [])
    top_service_text = ", ".join(
        f"{item['service']} ({item['total_cost']})" for item in top_services[:3]
    ) or "no service breakdown available"
    source_text = "synthetic fallback dataset" if data_source == "synthetic_fallback" else "AWS Cost Explorer data"
    return (
        f"Groq is not configured, so this is a local FinOps summary based on {source_text}. "
        f"For {time_frame}, total observed cost is {summary.get('total_cost')} across {summary.get('total_records')} grouped records. "
        f"The average daily cost is {summary.get('average_daily_cost')}, the peak day is {summary.get('peak_day')} at {summary.get('peak_day_cost')}, "
        f"and the biggest services are {top_service_text}. "
        f"Question received: {question}"
    )


# Sample automation lines for Monitor UI when using synthetic cost data (no AWS side effects).
_FALLBACK_MONITOR_DEMO_LOGS: list[dict[str, str]] = [
    {
        "action": "estimate_savings_plan",
        "service": "EC2",
        "status": "success",
        "message": "[Fallback demo] Compared Savings Plan vs on-demand for the top synthetic driver; no purchase executed.",
    },
    {
        "action": "schedule_off_hours",
        "service": "EC2",
        "status": "success",
        "message": "[Fallback demo] Simulated off-hours stop window for non-prod (no EC2 API calls in fallback mode).",
    },
    {
        "action": "rightsizing_review",
        "service": "RDS",
        "status": "logged",
        "message": "[Fallback demo] Logged rightsizing candidate from synthetic workload; would open a change in live mode.",
    },
    {
        "action": "skip",
        "service": "LAMBDA",
        "status": "ignored",
        "message": "[Fallback demo] Skipped automation: synthetic anomaly severity below high threshold.",
    },
]


def merge_fallback_monitor_demo_logs(
    data_source: str,
    runtime_logs: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Prepend illustrative logs when the monitor uses synthetic/fallback cost data only."""
    if data_source != "synthetic_fallback":
        return runtime_logs
    return list(_FALLBACK_MONITOR_DEMO_LOGS) + list(runtime_logs)


def build_monitor_reasoning_with_fallback(
    *,
    data_source: str,
    records: list[dict],
    logs: list[dict[str, str]],
    anomalies: list[CostData],
) -> list[dict]:
    reasoning = build_monitor_reasoning(records=records, logs=logs, anomalies=anomalies)
    if data_source != "synthetic_fallback":
        return reasoning
    reasoning = [row for row in reasoning if row.get("kind") != "policy"]
    banner = {
        "title": "Fallback mode — demo automation only",
        "detail": (
            "Figures come from the synthetic dataset (this monitor request did not use live AWS cost data). "
            "The automation entries are **samples** so the logs and reasoning panels match what you would see "
            "after real runs. Use Live AWS in the app for production data and genuine action history."
        ),
        "kind": "fallback_demo",
    }
    return [banner] + reasoning


def build_monitor_reasoning(
    *,
    records: list[dict],
    logs: list[dict[str, str]],
    anomalies: list[CostData],
) -> list[dict]:
    reasoning: list[dict] = []

    names = os.getenv("EC2_OPTIMIZATION_INSTANCE_NAMES") or os.getenv("EC2_OPTIMIZATION_NAME_TAG") or ""
    action = (os.getenv("EC2_OPTIMIZATION_ACTION") or "stop").strip().lower()
    bg = os.getenv("EC2_OPTIMIZATION_BACKGROUND", "").strip().lower() in ("1", "true", "yes")
    auto_fetch = os.getenv("EC2_OPTIMIZATION_AUTO", "").strip().lower() in ("1", "true", "yes")
    interval = os.getenv("EC2_OPTIMIZATION_POLICY_INTERVAL_SECONDS", "30")
    if names or bg or auto_fetch:
        reasoning.append(
            {
                "title": "EC2 termination policy (automation)",
                "detail": (
                    f"Name tag targets: {names or '(not set)'}. "
                    f"Primary action: {action}. "
                    f"Background worker: {'enabled' if bg else 'disabled'} "
                    f"(re-evaluates every ~{interval}s when enabled). "
                    f"After AWS cost fetch: {'runs name-tag pass' if auto_fetch else 'no automatic pass'}. "
                    "Instances must match tag:Name values; only running/pending/stopped (non-terminated) are candidates."
                ),
                "kind": "policy",
            }
        )

    service_totals: dict[str, float] = {}
    for record in records:
        service = str(record.get("service") or "Unassigned")
        service_totals[service] = service_totals.get(service, 0.0) + float(record.get("amount", 0.0))

    if service_totals:
        top_service, top_cost = max(service_totals.items(), key=lambda item: abs(item[1]))
        reasoning.append(
            {
                "title": f"{top_service} is the biggest active cost driver",
                "detail": (
                    f"The monitor found {top_service} contributing about {_json_float(top_cost)} "
                    "in the selected window, so optimization attention should start there."
                ),
                "kind": "cost_driver",
            }
        )

    if anomalies:
        latest_anomaly = max(anomalies, key=lambda item: item.date)
        reasoning.append(
            {
                "title": "Anomaly detection triggered optimization review",
                "detail": (
                    f"{latest_anomaly.service or 'Unknown service'} showed an anomalous cost on "
                    f"{latest_anomaly.date.isoformat()} with amount {_json_float(float(latest_anomaly.amount or 0.0))}. "
                    "That is why the automation pipeline evaluated follow-up actions (e.g. high-severity EC2)."
                ),
                "kind": "anomaly",
            }
        )

    for log in logs[:8]:
        act = log.get("action") or "event"
        svc = log.get("service") or "UNKNOWN"
        reasoning.append(
            {
                "title": f"Automation log: {act.replace('_', ' ')} ({svc})",
                "detail": log.get("message") or "No message.",
                "kind": log.get("status") or "log",
            }
        )

    if not reasoning:
        reasoning.append(
            {
                "title": "No optimization context yet",
                "detail": (
                    "There are no policy flags, cost drivers, anomalies, or automation log lines yet. "
                    "Enable EC2_OPTIMIZATION_INSTANCE_NAMES + BACKGROUND or call POST /optimization/ec2/run."
                ),
                "kind": "idle",
            }
        )

    return reasoning


@app.get("/aws/services")
def get_aws_services(
    time_frame: Literal["today", "past_one_week", "past_one_month", "past_one_year"] = Query(default="past_one_month"),
):
    try:
        cost_data = fetch_cost_data(time_frame=time_frame)
    except Exception as e:
        logger.exception("AWS service fetch failed")
        try:
            raise _http_exception_from_aws_error(e, headline="Unable to load AWS service names") from e
        except HTTPException:
            raise
        except Exception as map_err:
            raise HTTPException(
                status_code=500,
                detail=f"AWS service fetch failed, and error mapping failed: {map_err}",
            ) from map_err

    return {
        "time_frame": time_frame,
        "available_services": cost_data["available_services"],
        "start_date": cost_data["start_date"],
        "end_date": cost_data["end_date"],
    }


@app.get("/forecast/aws")
async def forecast_aws_costs(
    time_frame: Literal["today", "past_one_week", "past_one_month", "past_one_year"] = Query(default="past_one_month"),
    periods: int = Query(default=7, ge=1, le=90),
    services: list[str] = Query(default=[]),
    force_fallback: bool = Query(default=False),
    strict_aws: bool = Query(default=False),
):
    cost_data, data_source = get_cost_data_with_fallback(
        time_frame=time_frame,
        services=services,
        force_fallback=force_fallback,
        strict_aws=strict_aws,
    )

    forecast_payload = {
        "data": cost_data["records"],
        "periods": periods,
        "freq": "D",
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(ml_forecast_url(), json=forecast_payload)
            response.raise_for_status()
            forecast_result = response.json()
    except Exception as e:
        logger.error("ML forecast call failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=(
                f"Unable to generate forecast: {e}. "
                "Start the ML service (uvicorn ml_service:app --host 127.0.0.1 --port 8001) "
                "or set ML_FORECAST_URL in .env."
            ),
        ) from e

    return {
        "data_source": data_source,
        "time_frame": time_frame,
        "periods": periods,
        "available_services": cost_data["available_services"],
        "selected_services": cost_data.get("selected_services", services),
        "history_start_date": cost_data["start_date"],
        "history_end_date": cost_data["end_date"],
        "services": forecast_result.get("services", []),
        "raw_request": cost_data["request"],
        "raw_response": cost_data["raw_response"],
    }


@app.get("/what-if/simulate")
def simulate_what_if(
    time_frame: Literal["today", "past_one_week", "past_one_month", "past_one_year"] = Query(default="past_one_month"),
    service: str | None = Query(default=None),
    action: Literal["resize_instance", "delete_volume", "schedule_off_hours", "purchase_savings_plan"] = Query(default="resize_instance"),
    reduction_percent: float | None = Query(default=None, ge=0, le=100),
    force_fallback: bool = Query(default=False),
    strict_aws: bool = Query(default=False),
):
    scenario_impacts = {
        "resize_instance": 35.0,
        "delete_volume": 100.0,
        "schedule_off_hours": 25.0,
        "purchase_savings_plan": 18.0,
    }

    cost_data, data_source = get_cost_data_with_fallback(
        time_frame=time_frame,
        services=[service] if service else [],
        force_fallback=force_fallback,
        strict_aws=strict_aws,
    )

    records = cost_data["records"]
    if not records:
        raise HTTPException(status_code=404, detail="No cost records available for simulation")

    service_totals: dict[str, float] = {}
    service_daily: dict[str, dict[str, float]] = {}
    for record in records:
        service_name = str(record.get("service") or "Unassigned")
        amount = float(record.get("amount", 0.0))
        service_totals[service_name] = service_totals.get(service_name, 0.0) + amount
        bucket = service_daily.setdefault(service_name, {})
        bucket[str(record["date"])] = bucket.get(str(record["date"]), 0.0) + amount

    target_service = service if service in service_daily else max(service_totals, key=lambda key: service_totals[key])
    ordered_days = sorted(service_daily[target_service].items())
    daily_values = [value for _, value in ordered_days]
    window_days = max(len(daily_values), 1)
    overall_daily_average = sum(daily_values) / window_days
    recent_window = daily_values[-7:] if len(daily_values) >= 7 else daily_values
    recent_average = sum(recent_window) / max(len(recent_window), 1)
    early_window = daily_values[:7] if len(daily_values) >= 7 else daily_values
    early_average = sum(early_window) / max(len(early_window), 1)

    trend_ratio = 0.0
    if early_average:
        trend_ratio = (recent_average - early_average) / abs(early_average)

    projected_daily_cost = max(0.0, recent_average * 0.7 + overall_daily_average * 0.3)
    projected_daily_cost *= max(0.6, min(1.4, 1 + trend_ratio * 0.25))
    projected_monthly_cost = projected_daily_cost * 30

    applied_reduction_percent = reduction_percent if reduction_percent is not None else scenario_impacts[action]
    estimated_monthly_saving = projected_monthly_cost * (applied_reduction_percent / 100.0)
    optimized_monthly_cost = max(0.0, projected_monthly_cost - estimated_monthly_saving)

    return {
        "data_source": data_source,
        "time_frame": time_frame,
        "service": target_service,
        "action": action,
        "applied_reduction_percent": _json_float(applied_reduction_percent),
        "projected_monthly_cost": _json_float(projected_monthly_cost),
        "estimated_monthly_saving": _json_float(estimated_monthly_saving),
        "optimized_monthly_cost": _json_float(optimized_monthly_cost),
        "trend_ratio": _json_float(trend_ratio, places=4),
        "history_days": window_days,
        "history_start_date": cost_data["start_date"],
        "history_end_date": cost_data["end_date"],
        "available_services": cost_data["available_services"],
        "history": [
            {
                "date": day,
                "amount": _json_float(amount),
            }
            for day, amount in ordered_days
        ],
        "explanation": (
            "Projected monthly cost blends recent daily average with the full-window average, "
            "then applies a modest trend adjustment before calculating scenario savings."
        ),
    }


@app.post("/assistant/finops")
async def finops_assistant(request: FinOpsAssistantRequest):
    cost_data, data_source = get_cost_data_with_fallback(
        time_frame=request.time_frame,
        services=request.services,
        force_fallback=request.force_fallback,
        strict_aws=not request.force_fallback,
    )
    records = cost_data["records"]
    if not records:
        raise HTTPException(status_code=404, detail="No cost records available for the assistant")

    summary = build_finops_summary(records)
    prompt_context = {
        "question": request.question,
        "time_frame": request.time_frame,
        "data_source": data_source,
        "history_start_date": cost_data["start_date"],
        "history_end_date": cost_data["end_date"],
        "selected_services": cost_data.get("selected_services", request.services),
        "available_services": cost_data["available_services"],
        "summary": summary,
    }

    provider = "groq"
    model_name = groq_model()
    answer = ""
    if not groq_api_key():
        provider = "local_fallback"
        model_name = "local-summary"
        answer = build_local_finops_answer(
            question=request.question,
            time_frame=request.time_frame,
            data_source=data_source,
            summary=summary,
        )
    else:
        payload = {
            "model": model_name,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are CloudGuard, a friendly AI FinOps assistant. "
                        "Respond naturally to greetings and simple conversation, then help with cloud spend, "
                        "service usage, trends, savings opportunities, and anomalies using the provided context. "
                        "Be concise, clear, and practical. If the data source is synthetic fallback data, say that plainly."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(prompt_context),
                },
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {groq_api_key()}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                parsed = response.json()
                answer = (
                    parsed.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
        except Exception as e:
            logger.error("Groq assistant call failed: %s", e)
            provider = "local_fallback"
            model_name = "local-summary"
            answer = build_local_finops_answer(
                question=request.question,
                time_frame=request.time_frame,
                data_source=data_source,
                summary=summary,
            )

    return {
        "provider": provider,
        "model": model_name,
        "data_source": data_source,
        "question": request.question,
        "answer": answer,
        "time_frame": request.time_frame,
        "selected_services": cost_data.get("selected_services", request.services),
        "available_services": cost_data["available_services"],
        "history_start_date": cost_data["start_date"],
        "history_end_date": cost_data["end_date"],
        "summary": summary,
    }


@app.post("/costs/fetch")
async def fetch_and_store_costs(force_synthetic: bool = False, db: Session = Depends(get_db)):
    mode = "aws"
    aws_records: list[dict] = []
    synthetic_records: list[dict] = []
    records_to_insert: list[dict] = []

    if force_synthetic:
        print("Force synthetic mode enabled")
        mode = "forced_synthetic"
        try:
            synthetic_records = load_synthetic_records()
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"synthetic_costs.json not found at {SYNTHETIC_COSTS_PATH}",
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        records_to_insert = synthetic_records
        total_cost = sum(float(r.get("amount", 0.0)) for r in synthetic_records)
    else:
        aws_payload = fetch_cost_data()
        aws_records = aws_payload["records"]
        aws_count = len(aws_records)
        total_cost = sum(float(r["amount"]) for r in aws_records) if aws_records else 0.0
        logger.info("AWS records fetched: %s", aws_count)
        logger.info("AWS total cost: %s", total_cost)

        if not aws_records or total_cost == 0.0:
            print("AWS returned no usable data, using fallback")
            mode = "synthetic"
            try:
                synthetic_records = load_synthetic_records()
            except FileNotFoundError:
                raise HTTPException(
                    status_code=404,
                    detail=f"synthetic_costs.json not found at {SYNTHETIC_COSTS_PATH}",
                )
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            records_to_insert = synthetic_records
            total_cost = sum(float(r.get("amount", 0.0)) for r in synthetic_records)
        else:
            records_to_insert = aws_records

    logger.info("AWS records count: %s", len(aws_records))
    logger.info("Synthetic records count: %s", len(synthetic_records))
    logger.info("Total cost used for insert: %s", total_cost)

    created = insert_cost_records(db, records_to_insert)

    ml_payload = [
        {
            "date": str(r["date"]),
            "service": r.get("service"),
            "amount": float(r["amount"]),
        }
        for r in records_to_insert
    ]
    anomalies: list = []
    ml_raw_results: list = []
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(ml_detect_url(), json=ml_payload, headers=NGROK_HEADERS)
            response.raise_for_status()
            parsed = response.json()
            if isinstance(parsed, list):
                ml_raw_results = parsed
                # Transform ML results to action handler format
                anomalies = transform_ml_anomalies(parsed)
                logger.info(f"ML returned {len(ml_raw_results)} results, {len(anomalies)} anomalies detected")
            else:
                anomalies = []
    except Exception as e:
        logger.error("ML detect call failed: %s", e)
        anomalies = []

    # Handle anomalies and take actions
    actions_result = {"actions_taken": []}
    if anomalies:
        logger.info(f"Processing {len(anomalies)} anomalies for action handling")
        actions_result = handle_anomalies(anomalies)
        logger.info(f"Actions taken: {actions_result.get('actions_taken', [])}")
    else:
        logger.info("No anomalies detected, no actions taken")

    if mode == "aws":
        proactive = run_proactive_ec2_optimization_if_enabled()
        extra = proactive.get("actions_taken", [])
        if extra:
            actions_result.setdefault("actions_taken", []).extend(extra)
            logger.info(f"Proactive EC2 optimization actions: {extra}")

    return {
        "mode": mode,
        "records_created": created,
        "total_records_sent_to_ml": len(ml_payload),
        "anomalies": anomalies,
        "actions_taken": actions_result.get("actions_taken", []),
    }


@app.post("/ingest")
async def ingest_cost_data(db: Session = Depends(get_db)):
    try:
        created = insert_synthetic_data(db)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"synthetic_costs.json not found at {SYNTHETIC_COSTS_PATH}",
        )
    except (ValueError, KeyError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    await run_anomaly_detection(db)
    return {"message": "Synthetic data ingested", "records_created": created}


@app.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    rows = db.execute(select(CostData).order_by(CostData.id.desc()).limit(50)).scalars().all()
    return {
        "data": [
            {
                "id": row.id,
                "date": row.date.isoformat(),
                "amount": _json_float(row.amount),
                "service": row.service,
                "anomaly_score": _json_float(row.anomaly_score, places=8),
                "is_anomaly": row.is_anomaly,
            }
            for row in rows
        ]
    }


@app.get("/anomalies")
def get_anomalies(db: Session = Depends(get_db)):
    rows = db.execute(select(CostData).where(CostData.is_anomaly.is_(True))).scalars().all()
    return {
        "data": [
            {
                "id": row.id,
                "date": row.date.isoformat(),
                "amount": _json_float(row.amount),
                "service": row.service,
                "anomaly_score": _json_float(row.anomaly_score, places=8),
                "is_anomaly": row.is_anomaly,
            }
            for row in rows
        ]
    }


@app.get("/dashboard/cost-allocation")
def dashboard_cost_allocation(
    range: str | None = Query(default=None),
    group_by: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_cost_allocation(db, time_range=range, group_by=group_by)


@app.get("/dashboard/shared-costs")
def dashboard_shared_costs(
    range: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_shared_costs(db, time_range=range)


@app.get("/dashboard/unit-economics")
def dashboard_unit_economics(db: Session = Depends(get_db)):
    return get_unit_economics(db)


@app.get("/dashboard/forecast")
def dashboard_forecast(
    range: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_forecast(db, time_range=range)


@app.get("/dashboard/insights")
def dashboard_insights(
    range: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_anomaly_insights(db)


@app.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)


@app.get("/dashboard/logs")
def dashboard_logs():
    return {"logs": get_action_logs()}


@app.get("/monitor/services")
@app.get("/dashboard/monitor/services")
def monitor_services(
    time_frame: Literal["today", "past_one_week", "past_one_month", "past_one_year"] = Query(default="past_one_month"),
    force_fallback: bool = Query(default=False),
    strict_aws: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    cost_data, data_source = get_cost_data_with_fallback(
        time_frame=time_frame,
        services=[],
        force_fallback=force_fallback,
        strict_aws=strict_aws,
    )

    service_stats: dict[str, dict[str, float | int | str]] = {}
    for record in cost_data["records"]:
        service = str(record.get("service") or "Unassigned")
        amount = float(record.get("amount", 0.0))
        record_date = str(record.get("date"))
        bucket = service_stats.setdefault(
            service,
            {
                "service": service,
                "total_cost": 0.0,
                "record_count": 0,
                "last_seen": record_date,
            },
        )
        bucket["total_cost"] = float(bucket["total_cost"]) + amount
        bucket["record_count"] = int(bucket["record_count"]) + 1
        if record_date > str(bucket["last_seen"]):
            bucket["last_seen"] = record_date

    active_services = sorted(
        [
            {
                "service": str(item["service"]),
                "total_cost": _json_float(float(item["total_cost"])),
                "record_count": int(item["record_count"]),
                "last_seen": str(item["last_seen"]),
                "status": "active",
            }
            for item in service_stats.values()
        ],
        key=lambda item: abs(float(item["total_cost"] or 0.0)),
        reverse=True,
    )

    logs = merge_fallback_monitor_demo_logs(data_source, get_action_logs())
    anomalies = db.execute(
        select(CostData)
        .where(CostData.is_anomaly.is_(True))
        .order_by(CostData.date.desc())
        .limit(10)
    ).scalars().all()

    return {
        "data_source": data_source,
        "time_frame": time_frame,
        "active_services": active_services,
        "automation_logs": logs,
        "optimization_reasoning": build_monitor_reasoning_with_fallback(
            data_source=data_source,
            records=cost_data["records"],
            logs=logs,
            anomalies=anomalies,
        ),
        "service_count": len(active_services),
        "history_start_date": cost_data["start_date"],
        "history_end_date": cost_data["end_date"],
    }
