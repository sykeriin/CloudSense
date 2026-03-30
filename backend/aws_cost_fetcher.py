import os
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

import settings_env  # noqa: F401 — repo-root .env

TIME_FRAME_TO_DAYS = {
    "today": 1,
    "past_one_week": 7,
    "past_one_month": 30,
    "past_one_year": 365,
}


def _aws_client():
    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if not all([aws_access_key_id, aws_secret_access_key]):
        raise ValueError("AWS environment variables are missing. Check your .env file.")

    return boto3.client(
        "ce",
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    )


def resolve_time_window(time_frame: str) -> tuple[str, str]:
    if time_frame not in TIME_FRAME_TO_DAYS:
        raise ValueError(f"Unsupported time frame: {time_frame}")

    today = datetime.now(UTC).date()
    if time_frame == "today":
        start_date = today
    else:
        start_date = today - timedelta(days=TIME_FRAME_TO_DAYS[time_frame] - 1)
    end_date = today + timedelta(days=1)
    return start_date.isoformat(), end_date.isoformat()


def fetch_cost_data(
    *,
    time_frame: str = "past_one_month",
    services: list[str] | None = None,
) -> dict[str, Any]:
    start_date, end_date = resolve_time_window(time_frame)
    client = _aws_client()

    request: dict[str, Any] = {
        "TimePeriod": {
            "Start": start_date,
            "End": end_date,
        },
        "Granularity": "DAILY",
        "Metrics": ["UnblendedCost"],
        "GroupBy": [
            {
                "Type": "DIMENSION",
                "Key": "SERVICE",
            }
        ],
    }

    clean_services = [service for service in (services or []) if service]
    if clean_services:
        request["Filter"] = {
            "Dimensions": {
                "Key": "SERVICE",
                "Values": clean_services,
            }
        }

    response = client.get_cost_and_usage(**request)

    records: list[dict[str, Any]] = []
    available_services: set[str] = set()

    for time_bucket in response.get("ResultsByTime", []):
        bucket_start = time_bucket["TimePeriod"]["Start"]
        groups = time_bucket.get("Groups", [])

        if not groups:
            continue

        for group in groups:
            service = group.get("Keys", ["Unknown"])[0]
            amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
            records.append(
                {
                    "date": bucket_start,
                    "service": service,
                    "amount": amount,
                }
            )
            available_services.add(service)

    records.sort(key=lambda item: (item["date"], item["service"]))

    return {
        "request": request,
        "raw_response": response,
        "records": records,
        "available_services": sorted(available_services),
        "time_frame": time_frame,
        "start_date": start_date,
        "end_date": end_date,
    }
