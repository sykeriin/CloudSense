"""
Analytics service for dashboard insights.
Provides cost allocation, forecasting, and financial analytics.
"""
import logging
from config import UNIT_COUNT, UNIT_TYPE
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db.models import CostData

logger = logging.getLogger(__name__)

# Service to team mapping for tag simulation
SERVICE_TO_TEAM_MAP = {
    "EC2": "backend",
    "Lambda": "ml",
    "S3": "frontend",
    "RDS": "backend",
    "DynamoDB": "backend",
    "CloudFront": "frontend",
    "API Gateway": "backend",
    "SageMaker": "ml",
}

# Shared services that should be distributed
SHARED_SERVICES = ["Amazon VPC", "Data Transfer", "VPC", "CloudWatch"]


def get_cost_allocation(db: Session, time_range: str = None, group_by: str = None) -> dict:
    """Group cost data by service, team, and date."""
    rows = db.execute(select(CostData)).scalars().all()

    if not rows:
        return {"by_service": [], "by_team": [], "by_day": []}

    # Apply time range filter if specified
    if time_range:
        from datetime import datetime, timedelta
        days = 7 if time_range == '7d' else 30 if time_range == '30d' else 90
        cutoff_date = datetime.now().date() - timedelta(days=days)
        rows = [r for r in rows if r.date >= cutoff_date]

    by_service = {}
    by_team = {}
    by_day = {}

    for row in rows:
        service = row.service or "Unknown"
        amount = float(row.amount or 0)
        date_str = row.date.isoformat()

        # By service
        by_service[service] = by_service.get(service, 0) + amount

        # By team
        team = SERVICE_TO_TEAM_MAP.get(service, "other")
        by_team[team] = by_team.get(team, 0) + amount

        # By day
        by_day[date_str] = by_day.get(date_str, 0) + amount

    return {
        "by_service": [
            {"service": k, "total_cost": round(v, 2)}
            for k, v in sorted(by_service.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_team": [
            {"team": k, "total_cost": round(v, 2)}
            for k, v in sorted(by_team.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_day": [
            {"date": k, "total_cost": round(v, 2)}
            for k, v in sorted(by_day.items())
        ]
    }


def get_shared_costs(db: Session, time_range: str = None) -> dict:
    """Identify shared services and distribute costs across teams."""
    rows = db.execute(select(CostData)).scalars().all()

    if not rows:
        return {"total_shared_cost": 0.0, "distribution": []}

    # Apply time range filter if specified
    if time_range:
        from datetime import datetime, timedelta
        days = 7 if time_range == '7d' else 30 if time_range == '30d' else 90
        cutoff_date = datetime.now().date() - timedelta(days=days)
        rows = [r for r in rows if r.date >= cutoff_date]

    total_shared = 0.0
    team_costs = {}

    for row in rows:
        service = row.service or "Unknown"
        amount = float(row.amount or 0)

        if service in SHARED_SERVICES:
            total_shared += amount
        else:
            team = SERVICE_TO_TEAM_MAP.get(service, "other")
            team_costs[team] = team_costs.get(team, 0) + amount

    # Distribute shared costs proportionally
    total_team_cost = sum(team_costs.values())
    distribution = []

    if total_team_cost > 0:
        for team, cost in team_costs.items():
            proportion = cost / total_team_cost
            allocated = total_shared * proportion
            distribution.append({
                "team": team,
                "direct_cost": round(cost, 2),
                "allocated_shared_cost": round(allocated, 2),
                "total_cost": round(cost + allocated, 2)
            })
    else:
        # Even distribution if no team costs
        num_teams = len(set(SERVICE_TO_TEAM_MAP.values()))
        if num_teams > 0:
            per_team = total_shared / num_teams
            for team in set(SERVICE_TO_TEAM_MAP.values()):
                distribution.append({
                    "team": team,
                    "direct_cost": 0.0,
                    "allocated_shared_cost": round(per_team, 2),
                    "total_cost": round(per_team, 2)
                })

    return {
        "total_shared_cost": round(total_shared, 2),
        "distribution": sorted(distribution, key=lambda x: x["total_cost"], reverse=True)
    }


def get_unit_economics(db: Session) -> dict:
    """Calculate cost per unit."""
    result = db.execute(select(func.sum(CostData.amount))).scalar()
    total_cost = float(result or 0)

    unit_count = UNIT_COUNT
    unit_type = UNIT_TYPE

    cost_per_unit = total_cost / unit_count if unit_count > 0 else 0

    return {
        "total_cost": round(total_cost, 2),
        "units": unit_count,
        "cost_per_unit": round(cost_per_unit, 6),
        "unit_type": unit_type
    }


def get_forecast(db: Session, time_range: str = None) -> dict:
    """Forecast future costs based on historical data."""
    # Use time_range if provided, otherwise default to 14 days
    days = 14
    if time_range:
        days = 7 if time_range == '7d' else 30 if time_range == '30d' else 90
    cutoff_date = datetime.now().date() - timedelta(days=days)

    rows = db.execute(
        select(CostData.date, func.sum(CostData.amount).label("daily_total"))
        .where(CostData.date >= cutoff_date)
        .group_by(CostData.date)
        .order_by(CostData.date)
    ).all()

    if not rows or len(rows) < 2:
        return {
            "avg_daily_cost": 0.0,
            "projected_monthly_cost": 0.0,
            "trend": "stable",
            "data_points": 0
        }

    daily_costs = [float(row.daily_total) for row in rows]
    avg_daily = sum(daily_costs) / len(daily_costs)

    # Trend detection: compare first half vs second half
    mid = len(daily_costs) // 2
    first_half_avg = sum(daily_costs[:mid]) / mid if mid > 0 else 0
    second_half_avg = sum(daily_costs[mid:]) / (len(daily_costs) - mid) if (len(daily_costs) - mid) > 0 else 0

    if second_half_avg > first_half_avg * 1.1:
        trend = "increasing"
    elif second_half_avg < first_half_avg * 0.9:
        trend = "decreasing"
    else:
        trend = "stable"

    projected_monthly = avg_daily * 30

    return {
        "avg_daily_cost": round(avg_daily, 2),
        "projected_monthly_cost": round(projected_monthly, 2),
        "trend": trend,
        "data_points": len(daily_costs),
        "period_days": len(daily_costs)
    }


def get_anomaly_insights(db: Session) -> dict:
    """Get anomaly and action insights."""
    anomaly_rows = db.execute(
        select(CostData).where(CostData.is_anomaly.is_(True))
    ).scalars().all()

    anomalies = []
    total_anomaly_cost = 0.0

    for row in anomaly_rows:
        amount = float(row.amount or 0)
        total_anomaly_cost += amount
        anomalies.append({
            "date": row.date.isoformat(),
            "service": row.service,
            "amount": round(amount, 2),
            "anomaly_score": round(float(row.anomaly_score or 0), 4)
        })

    # Estimate potential savings (30% of anomaly costs)
    potential_savings = total_anomaly_cost * 0.3

    return {
        "anomalies_detected": anomalies,
        "total_anomaly_cost": round(total_anomaly_cost, 2),
        "potential_savings": round(potential_savings, 2),
        "anomaly_count": len(anomalies)
    }


def get_dashboard_summary(db: Session) -> dict:
    """Master endpoint combining all dashboard data."""
    return {
        "cost_allocation": get_cost_allocation(db),
        "shared_costs": get_shared_costs(db),
        "unit_economics": get_unit_economics(db),
        "forecast": get_forecast(db),
        "anomaly_insights": get_anomaly_insights(db)
    }
