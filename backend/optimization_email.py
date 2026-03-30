"""
Send email when optimization-related automation is logged.

Env:
  OPTIMIZATION_EMAIL_ENABLED=true
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD
  EMAIL_FROM, EMAIL_TO (comma-separated)

Body text is generated with Groq (OpenAI-compatible chat completions) when GROQ_API_KEY is set;
otherwise a plain template is used. Prophet forecast figures are fetched from ML_FORECAST_URL
(local ml_service by default) and passed to the model as grounding context.

  GROQ_API_KEY, GROQ_MODEL (optional, default llama-3.3-70b-versatile)
  ML_FORECAST_URL — POST /forecast on ml_service (default http://127.0.0.1:8001/forecast)
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

import settings_env  # noqa: F401

logger = logging.getLogger(__name__)

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def _env_bool(key: str) -> bool:
    return os.getenv(key, "").strip().lower() in ("1", "true", "yes")


def _smtp_configured() -> bool:
    return all(
        [
            os.getenv("SMTP_HOST", "").strip(),
            os.getenv("SMTP_USER", "").strip(),
            os.getenv("SMTP_PASSWORD", "").strip(),
            os.getenv("EMAIL_FROM", "").strip(),
            os.getenv("EMAIL_TO", "").strip(),
        ]
    )


def _groq_api_key() -> str:
    return os.getenv("GROQ_API_KEY", "").strip()


def _groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()


def ml_forecast_url() -> str:
    return (os.getenv("ML_FORECAST_URL") or "http://127.0.0.1:8001/forecast").strip()


def should_notify_optimization_email(action: str, status: str) -> bool:
    if not _env_bool("OPTIMIZATION_EMAIL_ENABLED"):
        return False
    if not _smtp_configured():
        return False
    if action in ("terminate_instance", "stop_instance"):
        return status in ("success", "failed")
    if action == "optimize_ec2":
        return status == "success"
    if action in ("chaos_terminate", "chaos_optimize", "chaos_anomaly"):
        return status in ("success", "logged", "failed")
    return False


def _build_prophet_summary() -> str:
    """Call Prophet service with recent cost rows; factual context for Groq or fallback body."""
    try:
        from aws_cost_fetcher import fetch_cost_data
    except Exception as e:
        return f"Prophet context skipped (import): {e}"

    try:
        cost = fetch_cost_data(time_frame="past_one_month")
        records = cost.get("records") or []
    except Exception as e:
        return f"Prophet context skipped (cost data): {e}"

    if len(records) < 2:
        return "Prophet context: not enough history rows for a forecast (need at least 2 days)."

    url = ml_forecast_url()
    payload = {"data": records, "periods": 7, "freq": "D"}

    try:
        with httpx.Client(timeout=90.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        return (
            f"Prophet service unreachable at {url} ({e}). "
            "Ensure ml_service is running and ML_FORECAST_URL is correct if not local."
        )

    services = data.get("services") or []
    lines: list[str] = []
    total_forecast_7d = 0.0
    ec2_forecast_7d = 0.0

    for svc in services:
        name = str(svc.get("service") or "")
        forecast = svc.get("forecast") or []
        tail = forecast[-7:] if forecast else []
        sub = sum(float(r.get("yhat", 0) or 0) for r in tail)
        total_forecast_7d += sub
        if "ec2" in name.lower():
            ec2_forecast_7d += sub
        if sub > 0:
            lines.append(f"  - {name}: next-7d Prophet yhat sum (USD): {sub:.2f}")

    summary = "Prophet (next 7 days, yhat sum across services):\n"
    summary += "\n".join(lines) if lines else "  (no per-service forecast rows returned)\n"
    summary += f"\nCombined projected 7-day total (yhat): ${total_forecast_7d:.2f}\n"
    if ec2_forecast_7d > 0:
        summary += (
            f"EC2-related services projected 7-day total (yhat): ${ec2_forecast_7d:.2f}\n"
            "These are model projections, not billing guarantees.\n"
        )
    else:
        summary += (
            "No EC2-labeled service series in this forecast window; use AWS Cost Explorer "
            "for line-item validation.\n"
        )
    return summary


def _build_fallback_body(action: str, service: str, status: str, message: str, prophet: str) -> str:
    return (
        f"Cloud optimization activity\n"
        f"----------------------------\n"
        f"Action:  {action}\n"
        f"Service: {service}\n"
        f"Status:  {status}\n"
        f"Detail:  {message}\n"
        f"\n"
        f"{prophet}\n"
        f"\n"
        f"(Template body — set GROQ_API_KEY for an LLM-written summary.)\n"
    )


def _compose_body_with_groq(action: str, service: str, status: str, message: str, prophet: str) -> str:
    key = _groq_api_key()
    if not key:
        return _build_fallback_body(action, service, status, message, prophet)

    user_payload = {
        "automation_event": {
            "action": action,
            "service": service,
            "status": status,
            "log_message": message,
        },
        "prophet_forecast_context": prophet,
    }
    payload = {
        "model": _groq_model(),
        "temperature": 0.25,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write short, professional plain-text emails to engineers about cloud cost "
                    "automation. Explain what happened, what was stopped or terminated (if any), "
                    "and the outcome. Use the Prophet forecast context only for cautious, qualitative "
                    "notes about projected spend or possible savings — never invent dollar figures "
                    "beyond what the context explicitly provides. If context is missing or says "
                    "unavailable, say savings cannot be estimated from forecasts. "
                    "Keep the email under 200 words. No markdown code fences."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(user_payload),
            },
        ],
    }
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            parsed = response.json()
            text = (
                parsed.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
        if text:
            return text
    except Exception as e:
        logger.warning("Groq optimization email generation failed, using template: %s", e)

    return _build_fallback_body(action, service, status, message, prophet)


def _send_smtp(subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587") or "587")
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("EMAIL_FROM", "").strip()
    to_raw = os.getenv("EMAIL_TO", "").strip()
    recipients = [e.strip() for e in to_raw.split(",") if e.strip()]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(host, port, timeout=60) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.sendmail(from_addr, recipients, msg.as_string())


def _notify_worker(action: str, service: str, status: str, message: str) -> None:
    try:
        subject = f"[Cloud optimization] {action} / {service} / {status}"
        prophet = _build_prophet_summary()
        body = _compose_body_with_groq(action, service, status, message, prophet)
        _send_smtp(subject, body)
        logger.info("Optimization notification email sent for action=%s", action)
    except Exception:
        logger.exception("Optimization notification email failed (action=%s)", action)


def schedule_optimization_email(action: str, service: str, status: str, message: str) -> None:
    if not should_notify_optimization_email(action, status):
        return
    thread = threading.Thread(
        target=_notify_worker,
        args=(action, service, status, message),
        daemon=True,
        name="optimization-email",
    )
    thread.start()
