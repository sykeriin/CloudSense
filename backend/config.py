"""
Configuration module for CloudSense backend.
Loads environment variables from repository root .env file.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repository root
_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv()


# Database Configuration
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

# ML Service URLs
ML_DETECT_URL = os.getenv("ML_DETECT_URL")
ML_ANOMALY_DETECT_URL = os.getenv("ML_ANOMALY_DETECT_URL")
ML_FORECAST_URL = os.getenv("ML_FORECAST_URL")
DEFAULT_ML_DETECT_URL = "https://thixotropic-chanel-infinitesimally.ngrok-free.dev/detect"
DEFAULT_ML_FORECAST_URL = "http://127.0.0.1:8001/forecast"

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

# EC2 Optimization Configuration
EC2_INSTANCE_ID = os.getenv("EC2_INSTANCE_ID")
EC2_OPTIMIZATION_INSTANCE_NAMES = os.getenv("EC2_OPTIMIZATION_INSTANCE_NAMES")
EC2_OPTIMIZATION_NAME_TAG = os.getenv("EC2_OPTIMIZATION_NAME_TAG")
EC2_OPTIMIZATION_ACTION = os.getenv("EC2_OPTIMIZATION_ACTION", "stop").strip().lower()
EC2_OPTIMIZATION_AUTO = os.getenv("EC2_OPTIMIZATION_AUTO", "").strip().lower() in ("1", "true", "yes")
EC2_OPTIMIZATION_BACKGROUND = os.getenv("EC2_OPTIMIZATION_BACKGROUND", "").strip().lower() in ("1", "true", "yes")
EC2_OPTIMIZATION_POLICY_INTERVAL_SECONDS = float(os.getenv("EC2_OPTIMIZATION_POLICY_INTERVAL_SECONDS", "30"))
EC2_OPTIMIZATION_SEARCH_REGIONS = os.getenv("EC2_OPTIMIZATION_SEARCH_REGIONS", "")

# Chaos Mode Configuration
ENABLE_CHAOS_MODE = os.getenv("ENABLE_CHAOS_MODE", "").strip().lower() in ("1", "true", "yes")
MAX_CHAOS_INSTANCES = int(os.getenv("MAX_CHAOS_INSTANCES", "1"))
CHAOS_ANOMALY_DELAY_SECONDS = float(os.getenv("CHAOS_ANOMALY_DELAY_SECONDS", "15"))
CHAOS_OPTIMIZE_DELAY_SECONDS = float(os.getenv("CHAOS_OPTIMIZE_DELAY_SECONDS", "15"))

# Dashboard and Analytics Configuration
AUTOMATION_LOG_READ_LIMIT = int(os.getenv("AUTOMATION_LOG_READ_LIMIT", "500"))
UNIT_COUNT = int(os.getenv("UNIT_COUNT", "1"))
UNIT_TYPE = os.getenv("UNIT_TYPE", "workspace")

# Email Configuration
OPTIMIZATION_EMAIL_ENABLED = os.getenv("OPTIMIZATION_EMAIL_ENABLED", "").strip().lower() in ("1", "true", "yes")
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587") or "587")
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
EMAIL_FROM = os.getenv("EMAIL_FROM", "").strip()
EMAIL_TO = os.getenv("EMAIL_TO", "").strip()


def get_ml_detect_url() -> str:
    """Get ML anomaly detection URL from environment or default."""
    return ML_DETECT_URL or ML_ANOMALY_DETECT_URL or DEFAULT_ML_DETECT_URL


def get_ml_forecast_url() -> str:
    """Get ML forecast URL from environment or default."""
    return ML_FORECAST_URL or DEFAULT_ML_FORECAST_URL


def get_groq_api_key() -> str:
    """Get Groq API key from environment."""
    return GROQ_API_KEY


def get_groq_model() -> str:
    """Get Groq model name from environment."""
    return GROQ_MODEL
