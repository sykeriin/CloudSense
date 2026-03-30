"""
EC2 optimization and automation action service.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Literal

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import desc, select

from config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_DEFAULT_REGION,
    EC2_INSTANCE_ID,
    EC2_OPTIMIZATION_INSTANCE_NAMES,
    EC2_OPTIMIZATION_NAME_TAG,
    EC2_OPTIMIZATION_ACTION,
    EC2_OPTIMIZATION_AUTO,
    EC2_OPTIMIZATION_BACKGROUND,
    EC2_OPTIMIZATION_SEARCH_REGIONS,
    AUTOMATION_LOG_READ_LIMIT,
)
from db.database import SessionLocal
from db.models import AutomationActionLog

logger = logging.getLogger(__name__)


def log_action(action: str, service: str, status: str, message: str) -> None:
    """Log automation action to database and optionally send email."""
    db = SessionLocal()
    try:
        db.add(AutomationActionLog(action=action, service=service, status=status, message=message))
        db.commit()
        try:
            from services.optimization_email import schedule_optimization_email
            schedule_optimization_email(action, service, status, message)
        except Exception:
            logger.warning("Optimization email scheduling failed", exc_info=True)
    except Exception:
        logger.exception("Failed to persist automation log (action=%s service=%s)", action, service)
        db.rollback()
    finally:
        db.close()


def get_action_logs(*, limit: int | None = None) -> list[dict[str, str]]:
    """Retrieve automation action logs from database."""
    cap = limit if limit is not None else AUTOMATION_LOG_READ_LIMIT
    db = SessionLocal()
    try:
        rows = db.execute(
            select(AutomationActionLog).order_by(desc(AutomationActionLog.created_at)).limit(cap)
        ).scalars().all()
        out: list[dict[str, str]] = []
        for row in rows:
            entry: dict[str, str] = {
                "action": row.action,
                "service": row.service,
                "status": row.status,
                "message": row.message,
            }
            if row.created_at is not None:
                entry["recorded_at"] = row.created_at.isoformat()
            out.append(entry)
        return out
    except Exception:
        logger.exception("get_action_logs failed")
        return []
    finally:
        db.close()


def seed_archived_action_logs_once() -> None:
    """Restore important historical rows if missing (safe to run on every startup)."""
    archived: list[dict[str, Any]] = [
        {
            "created_at": datetime(2026, 3, 28, 19, 30, 0, tzinfo=timezone.utc),
            "action": "terminate_instance",
            "service": "EC2",
            "status": "success",
            "message": "EC2 instance i-0337a7f2e4321da60 in ap-south-2 terminated (manual_api_trigger)",
        },
    ]
    db = SessionLocal()
    try:
        for entry in archived:
            exists = db.execute(
                select(AutomationActionLog.id).where(AutomationActionLog.message == entry["message"]).limit(1)
            ).first()
            if exists:
                continue
            db.add(
                AutomationActionLog(
                    created_at=entry["created_at"],
                    action=entry["action"],
                    service=entry["service"],
                    status=entry["status"],
                    message=entry["message"],
                )
            )
        db.commit()
    except Exception:
        logger.exception("seed_archived_action_logs_once failed")
        db.rollback()
    finally:
        db.close()


def _ec2_client_for_region(region_name: str):
    """Create EC2 client for specific region."""
    return boto3.client(
        "ec2",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=region_name,
    )


def _ec2_client():
    """Create EC2 client for default region."""
    return _ec2_client_for_region(AWS_DEFAULT_REGION)


def _lookup_region_list() -> list[str]:
    """Regions used when resolving instances by Name tag (and retries)."""
    primary = AWS_DEFAULT_REGION
    extra = EC2_OPTIMIZATION_SEARCH_REGIONS.strip() if EC2_OPTIMIZATION_SEARCH_REGIONS else ""
    if extra:
        regions = [primary]
        for part in extra.split(","):
            s = part.strip()
            if s and s not in regions:
                regions.append(s)
        return regions
    regions = [primary, "ap-south-1", "ap-south-2", "eu-west-1", "us-west-2"]
    seen: set[str] = set()
    out: list[str] = []
    for r in regions:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def discover_instances_by_name(names: list[str]) -> list[tuple[str, str]]:
    """Return (instance_id, region) for each non-terminated match."""
    if not names:
        return []
    found: list[tuple[str, str]] = []
    seen_ids: set[str] = set()
    for region in _lookup_region_list():
        try:
            ec2 = _ec2_client_for_region(region)
            for iid in _instance_ids_by_name_tags(ec2, names):
                if iid not in seen_ids:
                    seen_ids.add(iid)
                    found.append((iid, region))
        except (BotoCoreError, ClientError) as e:
            logger.debug("EC2 describe_instances in %s failed: %s", region, e)
            continue
    return found


def _optimization_action_from_env() -> Literal["stop", "terminate"]:
    """Get EC2 optimization action from config."""
    return "terminate" if EC2_OPTIMIZATION_ACTION == "terminate" else "stop"


def _names_from_env() -> list[str]:
    """Get EC2 instance names from config."""
    raw = EC2_OPTIMIZATION_INSTANCE_NAMES or EC2_OPTIMIZATION_NAME_TAG or ""
    return [n.strip() for n in raw.split(",") if n.strip()]


def _instance_ids_by_name_tags(ec2, names: list[str]) -> list[str]:
    """Find EC2 instance IDs by Name tag."""
    if not names:
        return []
    found: list[str] = []
    paginator = ec2.get_paginator("describe_instances")
    for page in paginator.paginate(
        Filters=[
            {"Name": "tag:Name", "Values": names},
        ],
    ):
        for reservation in page.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                state = (inst.get("State") or {}).get("Name", "")
                if state in ("terminated", "shutting-down"):
                    continue
                iid = inst.get("InstanceId")
                if iid:
                    found.append(iid)
    return found


def resolve_ec2_target_instance_ids(
    *,
    include_explicit_ids: bool = True,
    instance_names: list[str] | None = None,
) -> list[tuple[str, str]]:
    """
    Resolve EC2 instance targets from config.
    instance_names=None uses env; empty list means do not resolve by name.
    Returns (instance_id, region) so stop/terminate call the correct regional endpoint.
    """
    pairs: list[tuple[str, str]] = []
    default_region = AWS_DEFAULT_REGION
    if include_explicit_ids and EC2_INSTANCE_ID:
        for part in EC2_INSTANCE_ID.split(","):
            s = part.strip()
            if s:
                pairs.append((s, default_region))

    names = _names_from_env() if instance_names is None else list(instance_names)
    if names:
        try:
            pairs.extend(discover_instances_by_name(names))
        except Exception as e:
            msg = f"Failed to resolve EC2 instances by Name tag {names!r}: {e}"
            logger.error(msg)
            log_action("optimize_ec2", "EC2", "failed", msg)

    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for iid, region in pairs:
        if iid not in seen:
            seen.add(iid)
            unique.append((iid, region))
    return unique


def run_ec2_optimization(
    reason: str,
    *,
    include_explicit_ids: bool = True,
    instance_names: list[str] | None = None,
    action: Literal["stop", "terminate"] | None = None,
    silent_if_no_targets: bool = False,
) -> list[str]:
    """
    Stop or terminate resolved targets; every attempt is persisted for the monitor UI.
    """
    eff_action = action if action is not None else _optimization_action_from_env()
    targets = resolve_ec2_target_instance_ids(
        include_explicit_ids=include_explicit_ids,
        instance_names=instance_names,
    )
    if not targets:
        if not silent_if_no_targets:
            msg = (
                f"No EC2 targets for {reason}. Set EC2_INSTANCE_ID and/or EC2_OPTIMIZATION_INSTANCE_NAMES "
                "(Name tag, e.g. test), or expand EC2_OPTIMIZATION_SEARCH_REGIONS."
            )
            logger.warning(msg)
            log_action("optimize_ec2", "EC2", "failed", msg)
        else:
            logger.debug("No EC2 targets for %s (silent)", reason)
        return []

    actions_taken: list[str] = []
    action_key = "terminate_instance" if eff_action == "terminate" else "stop_instance"

    for iid, region in targets:
        ec2 = _ec2_client_for_region(region)
        try:
            if eff_action == "terminate":
                ec2.terminate_instances(InstanceIds=[iid])
                msg = f"EC2 instance {iid} in {region} terminated ({reason})"
            else:
                ec2.stop_instances(InstanceIds=[iid])
                msg = f"EC2 instance {iid} in {region} stopped ({reason})"
            logger.info(msg)
            log_action(action_key, "EC2", "success", msg)
            actions_taken.append(msg)
        except ClientError as e:
            code = (e.response.get("Error") or {}).get("Code", "")
            if code in ("InvalidInstanceID.NotFound", "InvalidInstanceID.Malformed") and include_explicit_ids:
                alt = _try_explicit_id_other_regions(iid, eff_action, reason, action_key)
                if alt:
                    actions_taken.append(alt)
                else:
                    msg = f"EC2 {eff_action}: instance {iid} not found in any configured region ({reason})"
                    logger.error(msg)
                    log_action(action_key, "EC2", "failed", msg)
                continue
            if code == "IncorrectState" and eff_action == "stop":
                skip_msg = f"EC2 {iid} ({region}) not in a stoppable state (likely already stopped); skipped ({reason})"
                logger.info(skip_msg)
                log_action(action_key, "EC2", "ignored", skip_msg)
                continue
            msg = f"EC2 {eff_action} failed for {iid} in {region}: {e} ({reason})"
            logger.error(msg)
            log_action(action_key, "EC2", "failed", msg)
        except BotoCoreError as e:
            msg = f"EC2 {eff_action} failed for {iid} in {region}: {e} ({reason})"
            logger.error(msg)
            log_action(action_key, "EC2", "failed", msg)

    return actions_taken


def _try_explicit_id_other_regions(
    iid: str,
    eff_action: Literal["stop", "terminate"],
    reason: str,
    action_key: str,
) -> str | None:
    """If EC2_INSTANCE_ID points at the wrong default region, try other lookup regions."""
    default_region = AWS_DEFAULT_REGION
    for region in _lookup_region_list():
        if region == default_region:
            continue
        ec2 = _ec2_client_for_region(region)
        try:
            if eff_action == "terminate":
                ec2.terminate_instances(InstanceIds=[iid])
                msg = f"EC2 instance {iid} in {region} terminated ({reason})"
            else:
                ec2.stop_instances(InstanceIds=[iid])
                msg = f"EC2 instance {iid} in {region} stopped ({reason})"
            logger.info(msg)
            log_action(action_key, "EC2", "success", msg)
            return msg
        except ClientError as e:
            code = (e.response.get("Error") or {}).get("Code", "")
            if code in ("InvalidInstanceID.NotFound", "InvalidInstanceID.Malformed"):
                continue
            msg = f"EC2 {eff_action} failed for {iid} in {region}: {e} ({reason})"
            logger.error(msg)
            log_action(action_key, "EC2", "failed", msg)
            return msg
        except BotoCoreError:
            continue
    return None


def run_proactive_ec2_optimization_if_enabled() -> dict[str, list[str]]:
    """Run EC2 optimization if auto mode is enabled."""
    if not EC2_OPTIMIZATION_AUTO:
        return {"actions_taken": []}
    if not _names_from_env():
        log_action(
            "optimize_ec2",
            "EC2",
            "ignored",
            "EC2_OPTIMIZATION_AUTO is enabled but EC2_OPTIMIZATION_INSTANCE_NAMES (or NAME_TAG) is empty; no targets",
        )
        return {"actions_taken": []}
    taken = run_ec2_optimization("scheduled_name_tag_policy", include_explicit_ids=False)
    return {"actions_taken": taken}


def run_ec2_background_policy_tick() -> dict[str, list[str]]:
    """Called on a timer when EC2_OPTIMIZATION_BACKGROUND is true. Uses name-tag targets only."""
    if not EC2_OPTIMIZATION_BACKGROUND:
        return {"actions_taken": []}
    if not _names_from_env():
        return {"actions_taken": []}
    taken = run_ec2_optimization(
        "background_policy_tick",
        include_explicit_ids=False,
        silent_if_no_targets=True,
    )
    return {"actions_taken": taken}


def handle_anomalies(anomalies: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Handle detected anomalies and trigger appropriate actions."""
    actions_taken: list[str] = []

    for anomaly in anomalies:
        service = anomaly.get("service", "").upper()
        severity = anomaly.get("severity", "").lower()

        if severity != "high":
            message = f"Skipped {service} anomaly with severity: {severity}"
            logger.info(message)
            log_action("skip", service or "UNKNOWN", "ignored", message)
            continue

        if service == "EC2":
            outcome = handle_ec2_anomaly()
            if outcome:
                actions_taken.extend(outcome)
        elif service == "LAMBDA":
            action = handle_lambda_anomaly()
            if action:
                actions_taken.append(action)
        else:
            message = f"Unknown service: {service}"
            logger.warning(message)
            log_action("unsupported_service", service or "UNKNOWN", "ignored", message)

    return {"actions_taken": actions_taken}


def handle_ec2_anomaly() -> list[str] | None:
    """Handle EC2 anomaly by running optimization."""
    taken = run_ec2_optimization("cost_anomaly_high_severity", include_explicit_ids=True)
    return taken if taken else None


def handle_lambda_anomaly() -> str:
    """Handle Lambda anomaly (observation only)."""
    message = "Lambda anomaly detected (no action taken)"
    logger.info(message)
    log_action("observe_lambda", "LAMBDA", "logged", message)
    return message
