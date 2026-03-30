"""
ML-based anomaly detection service.
"""
import logging
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_ml_detect_url
from db.models import CostData

logger = logging.getLogger(__name__)

# Headers so ngrok free tier does not block programmatic POSTs
_NGROK_HEADERS = {"ngrok-skip-browser-warning": "true"}


async def run_anomaly_detection(db: Session) -> None:
    """
    POST all cost_data to the ML service, then update anomaly_score / is_anomaly by date.
    Accepts ML responses with either (anomaly_score, is_anomaly) or (score, anomaly).
    """
    ml_url = get_ml_detect_url()
    rows = list(db.execute(select(CostData)).scalars().all())
    if not rows:
        return

    cost_data = [{"date": row.date.isoformat(), "amount": row.amount} for row in rows]

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                ml_url,
                json=cost_data,
                headers=_NGROK_HEADERS,
            )
            response.raise_for_status()
            results = response.json()
    except httpx.HTTPError as e:
        logger.error("ML anomaly service HTTP error: %s", e)
        return
    except Exception as e:
        logger.error("ML anomaly service error: %s", e)
        return

    if not isinstance(results, list):
        logger.error("ML anomaly service returned non-list response; skipping updates")
        return

    for item in results:
        try:
            item_date = date.fromisoformat(item["date"])
        except (KeyError, TypeError, ValueError):
            logger.warning("Skipping malformed ML result item: %s", item)
            continue

        score = item.get("anomaly_score", item.get("score"))
        is_flag = bool(item.get("is_anomaly", item.get("anomaly", False)))

        for row in rows:
            if row.date == item_date:
                row.anomaly_score = float(score) if score is not None else None
                row.is_anomaly = is_flag

    try:
        db.commit()
    except Exception as e:
        logger.error("Failed to commit anomaly detection updates: %s", e)
        db.rollback()
