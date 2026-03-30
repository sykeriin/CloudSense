"""
Load repository-root .env regardless of process cwd (e.g. uvicorn started from backend/).
Without this, ENABLE_CHAOS_MODE and other vars in ../.env are invisible to os.getenv.
"""
from pathlib import Path

from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv()
