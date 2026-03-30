"""
Controlled chaos demo: one small tagged EC2 instance, simulated anomaly logs, then terminate.
Does not modify cost fetching, fallback logic, or ML pipelines.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import desc, select, update

import settings_env  # noqa: F401 — repo-root .env
from actions import log_action
from database import SessionLocal
from models import ChaosModeRun

logger = logging.getLogger(__name__)

_chaos_task: asyncio.Task | None = None
_chaos_cancel: asyncio.Event | None = None
_chaos_lock = asyncio.Lock()

INSTANCE_TYPE = "t3.micro"
NAME_TAG = "chaos-test"


def _env_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).strip().lower() in ("1", "true", "yes")


def is_chaos_mode_enabled() -> bool:
    return _env_bool("ENABLE_CHAOS_MODE", "false")


def max_chaos_instances() -> int:
    try:
        return max(1, min(3, int(os.getenv("MAX_CHAOS_INSTANCES", "1"))))
    except ValueError:
        return 1


def _friendly_boto_error(exc: Exception) -> str:
    """Surface actionable text when AWS quarantines keys (not fixable in app code)."""
    raw = str(exc)
    if "AWSCompromisedKeyQuarantineV3" in raw or "CompromisedKeyQuarantine" in raw:
        return (
            "Your IAM user is blocked by AWS managed policy AWSCompromisedKeyQuarantineV3 "
            "(explicit deny on ec2:RunInstances and other APIs). AWS attaches this when a key "
            "may be exposed; it is not caused by Chaos Mode or email features. Fix: create new "
            "IAM access keys or use a different IAM user/role, update credentials in .env, and "
            "follow AWS guidance to remove the quarantine if required. "
            f"Details: {raw}"
        )
    return raw


def _ec2_client(region: str):
    return boto3.client(
        "ec2",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=region,
    )


def _ssm_client(region: str):
    return boto3.client(
        "ssm",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=region,
    )


def _resolve_al2023_ami(region: str) -> str | None:
    try:
        ssm = _ssm_client(region)
        r = ssm.get_parameter(Name="/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64")
        return r["Parameter"]["Value"].strip()
    except (BotoCoreError, ClientError, KeyError) as e:
        logger.warning("SSM AMI lookup failed: %s", e)
        return None


def _default_subnet_and_sg(ec2) -> tuple[str | None, str | None]:
    try:
        vpcs = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])
        if not vpcs.get("Vpcs"):
            return None, None
        vpc_id = vpcs["Vpcs"][0]["VpcId"]
        subs = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
        if not subs.get("Subnets"):
            return None, None
        subnet_id = subs["Subnets"][0]["SubnetId"]
        sgs = ec2.describe_security_groups(
            Filters=[{"Name": "vpc-id", "Values": [vpc_id]}, {"Name": "group-name", "Values": ["default"]}]
        )
        if not sgs.get("SecurityGroups"):
            return subnet_id, None
        sg_id = sgs["SecurityGroups"][0]["GroupId"]
        return subnet_id, sg_id
    except (BotoCoreError, ClientError, KeyError, IndexError) as e:
        logger.warning("VPC/subnet/SG lookup failed: %s", e)
        return None, None


def _count_active_runs() -> int:
    db = SessionLocal()
    try:
        rows = db.execute(
            select(ChaosModeRun).where(ChaosModeRun.status.in_(["pending", "running", "optimizing"]))
        ).scalars().all()
        return len(rows)
    finally:
        db.close()


def _insert_run(instance_id: str, region: str, status: str) -> int:
    db = SessionLocal()
    try:
        row = ChaosModeRun(instance_id=instance_id, region=region, status=status)
        db.add(row)
        db.commit()
        db.refresh(row)
        return int(row.id)
    finally:
        db.close()


def _update_run_status(run_id: int | None, instance_id: str, status: str) -> None:
    db = SessionLocal()
    try:
        if run_id is not None:
            db.execute(update(ChaosModeRun).where(ChaosModeRun.id == run_id).values(status=status, updated_at=datetime.now(timezone.utc)))
        else:
            db.execute(
                update(ChaosModeRun)
                .where(ChaosModeRun.instance_id == instance_id)
                .values(status=status, updated_at=datetime.now(timezone.utc))
            )
        db.commit()
    except Exception:
        logger.exception("update chaos run status")
        db.rollback()
    finally:
        db.close()


def _launch_chaos_instance_sync(region: str) -> tuple[str | None, str | None]:
    """Returns (instance_id, error_message)."""
    ec2 = _ec2_client(region)
    ami = _resolve_al2023_ami(region)
    if not ami:
        return None, "Could not resolve Amazon Linux 2023 AMI (SSM)."
    subnet_id, sg_id = _default_subnet_and_sg(ec2)
    if not subnet_id or not sg_id:
        return None, "No default VPC subnet or default security group found."

    try:
        kwargs: dict[str, Any] = {
            "ImageId": ami,
            "MinCount": 1,
            "MaxCount": 1,
            "InstanceType": INSTANCE_TYPE,
            "SubnetId": subnet_id,
            "SecurityGroupIds": [sg_id],
            "TagSpecifications": [
                {
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Name", "Value": NAME_TAG},
                        {"Key": "ChaosMode", "Value": "true"},
                    ],
                }
            ],
        }
        resp = ec2.run_instances(**kwargs)
        iid = resp["Instances"][0]["InstanceId"]
        return iid, None
    except (BotoCoreError, ClientError, KeyError, IndexError) as e:
        return None, _friendly_boto_error(e)


def _terminate_instance_sync(instance_id: str, region: str) -> str | None:
    ec2 = _ec2_client(region)
    try:
        ec2.terminate_instances(InstanceIds=[instance_id])
        return None
    except ClientError as e:
        code = (e.response.get("Error") or {}).get("Code", "")
        if code == "InvalidInstanceID.NotFound":
            return None
        return _friendly_boto_error(e)
    except BotoCoreError as e:
        return _friendly_boto_error(e)


def cleanup_stale_chaos_runs() -> None:
    """Best-effort terminate instances left from crashed runs."""
    db = SessionLocal()
    try:
        rows = db.execute(
            select(ChaosModeRun)
            .where(ChaosModeRun.status.in_(["pending", "running", "optimizing"]))
            .order_by(desc(ChaosModeRun.created_at))
            .limit(5)
        ).scalars().all()
        for row in rows:
            err = _terminate_instance_sync(row.instance_id, row.region)
            if err:
                logger.warning("Stale chaos cleanup terminate %s: %s", row.instance_id, err)
            db.execute(
                update(ChaosModeRun)
                .where(ChaosModeRun.id == row.id)
                .values(status="cleaned_up", updated_at=datetime.now(timezone.utc)),
            )
        db.commit()
    except Exception:
        logger.exception("cleanup_stale_chaos_runs")
        db.rollback()
    finally:
        db.close()


async def _sleep_or_cancel(seconds: float, cancel: asyncio.Event) -> bool:
    """Returns True if cancelled."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + seconds
    while loop.time() < deadline:
        if cancel.is_set():
            return True
        await asyncio.sleep(min(0.5, deadline - loop.time()))
    return cancel.is_set()


async def _chaos_workflow() -> None:
    global _chaos_task, _chaos_cancel
    cancel = _chaos_cancel or asyncio.Event()
    region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
    run_id: int | None = None
    instance_id: str | None = None

    try:
        if _count_active_runs() >= max_chaos_instances():
            log_action("chaos_mode", "CHAOS", "ignored", "Maximum concurrent chaos runs reached.")
            return

        log_action("chaos_mode", "CHAOS", "success", "Chaos Mode started")

        iid, err = await asyncio.to_thread(_launch_chaos_instance_sync, region)
        if err or not iid:
            msg = err or "Launch failed."
            log_action("chaos_mode", "CHAOS", "failed", f"Chaos EC2 launch failed: {msg}")
            return

        instance_id = iid
        run_id = await asyncio.to_thread(_insert_run, iid, region, "running")
        log_action(
            "chaos_launch",
            "EC2",
            "success",
            f"Created EC2 instance {iid} ({INSTANCE_TYPE}, {region}, tag Name={NAME_TAG}).",
        )

        delay1 = float(os.getenv("CHAOS_ANOMALY_DELAY_SECONDS", "20"))
        if await _sleep_or_cancel(delay1, cancel):
            await asyncio.to_thread(_terminate_instance_sync, iid, region)
            _update_run_status(run_id, iid, "cancelled")
            log_action("chaos_mode", "CHAOS", "ignored", "Chaos Mode stopped before anomaly simulation.")
            return

        log_action(
            "chaos_anomaly",
            "EC2",
            "logged",
            "Anomaly detected: EC2 spike (simulated; ML pipeline not invoked).",
        )

        await asyncio.to_thread(_update_run_status, run_id, iid, "optimizing")
        log_action(
            "chaos_optimize",
            "EC2",
            "success",
            "Optimization triggered: terminating instance (chaos cleanup).",
        )

        delay2 = float(os.getenv("CHAOS_OPTIMIZE_DELAY_SECONDS", "5"))
        if await _sleep_or_cancel(delay2, cancel):
            await asyncio.to_thread(_terminate_instance_sync, iid, region)
            _update_run_status(run_id, iid, "cancelled")
            log_action("chaos_mode", "CHAOS", "ignored", "Chaos Mode cancelled during optimization delay.")
            return

        terr = await asyncio.to_thread(_terminate_instance_sync, iid, region)
        if terr:
            log_action("chaos_terminate", "EC2", "failed", f"Terminate chaos instance failed: {terr}")
            _update_run_status(run_id, iid, "failed")
        else:
            log_action(
                "chaos_terminate",
                "EC2",
                "success",
                f"Instance {iid} terminated successfully",
            )
            _update_run_status(run_id, iid, "cleaned_up")

    except Exception:
        logger.exception("chaos workflow")
        log_action("chaos_mode", "CHAOS", "failed", "Chaos workflow raised an unexpected error.")
        if instance_id:
            await asyncio.to_thread(_terminate_instance_sync, instance_id, region)
            _update_run_status(run_id, instance_id, "failed")
    finally:
        async with _chaos_lock:
            _chaos_task = None
            _chaos_cancel = None


async def start_chaos_mode() -> dict[str, str]:
    """Schedule chaos workflow; returns immediately."""
    global _chaos_task, _chaos_cancel

    async with _chaos_lock:
        if _chaos_task is not None and not _chaos_task.done():
            return {"status": "already_running", "message": "Chaos workflow already active."}
        _chaos_cancel = asyncio.Event()
        _chaos_task = asyncio.create_task(_chaos_workflow())

    return {"status": "started", "message": "Chaos mode initiated"}


async def stop_chaos_mode() -> dict[str, str]:
    """Signal cancel and terminate any known chaos instance."""
    global _chaos_task, _chaos_cancel

    if _chaos_cancel is not None:
        _chaos_cancel.set()

    db = SessionLocal()
    try:
        rows = db.execute(
            select(ChaosModeRun)
            .where(ChaosModeRun.status.in_(["pending", "running", "optimizing"]))
            .order_by(desc(ChaosModeRun.created_at))
            .limit(3)
        ).scalars().all()
        for row in rows:
            err = await asyncio.to_thread(_terminate_instance_sync, row.instance_id, row.region)
            if err:
                logger.warning("stop_chaos terminate %s: %s", row.instance_id, err)
            db.execute(
                update(ChaosModeRun)
                .where(ChaosModeRun.id == row.id)
                .values(status="cancelled", updated_at=datetime.now(timezone.utc))
            )
        db.commit()
    except Exception:
        logger.exception("stop_chaos_mode db")
        db.rollback()
    finally:
        db.close()

    log_action("chaos_mode", "CHAOS", "success", "Chaos Mode stop requested; instances terminated where possible.")

    return {"status": "stopped", "message": "Chaos stop and cleanup requested"}
