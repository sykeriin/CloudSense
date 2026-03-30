from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, Text, func

from database import Base, engine


class CostData(Base):
    __tablename__ = "cost_data"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    service = Column(String(255), nullable=True)
    anomaly_score = Column(Float, nullable=True)
    is_anomaly = Column(Boolean, nullable=False, default=False)


class AutomationActionLog(Base):
    """Durable automation / optimization action history for the monitor UI."""

    __tablename__ = "automation_action_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    action = Column(String(128), nullable=False)
    service = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False)
    message = Column(Text, nullable=False)


class ChaosModeRun(Base):
    """Tracks chaos demo EC2 instances for cleanup and auditing."""

    __tablename__ = "chaos_mode_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    instance_id = Column(String(40), nullable=False, index=True)
    region = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)


Base.metadata.create_all(bind=engine)
