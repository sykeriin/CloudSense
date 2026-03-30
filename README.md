# CloudSense

CloudSense is a cloud cost intelligence project for monitoring AWS spend, detecting anomalies, forecasting costs, and surfacing FinOps recommendations through a React dashboard backed by FastAPI services.

## What It Does

- Pulls AWS Cost Explorer data with service-level breakdowns
- Falls back to a synthetic dataset when live AWS data is unavailable
- Detects anomalies with an Isolation Forest-based ML service
- Forecasts future spend with Prophet
- Exposes dashboard APIs for cost allocation, shared costs, unit economics, forecast, insights, and monitoring
- Includes EC2 automation hooks for stop/terminate workflows and a controlled chaos-mode demo path
- Provides an in-app FinOps assistant with Groq or a local fallback summary mode

## Repo Structure

```text
.
|-- backend/                         FastAPI backend and AWS/automation logic
|-- frontend/                        Main Vite + React dashboard
|-- ml_service.py                    ML service for anomaly detection and forecasting
|-- synthetic_costs.json             Demo/fallback cost dataset
|-- requirements.txt                 Python dependencies for backend/ml service
|-- docs.md                          Hackathon documentation notes
|-- hackathon_report.md              Project report and asset/library list
|-- everything-with-customisable-dash/
|-- landing page/
```

`everything-with-customisable-dash/` and `landing page/` look like related prototype or alternate app folders. The root `backend/`, `frontend/`, and `ml_service.py` form the main working app.

## Architecture

### Frontend

- Vite + React 19 + TypeScript
- Recharts, Lucide, Tailwind tooling, motion
- Runs on port `3000` by default

### Backend

- FastAPI + SQLAlchemy + PostgreSQL
- AWS Cost Explorer integration via `boto3`
- HTTP integration with the ML service
- FinOps assistant, dashboard APIs, optimization logs, and chaos-mode endpoints

### ML Service

- FastAPI
- Isolation Forest for anomaly detection
- Prophet for forecasting

## Key Endpoints

### Backend (`backend/main.py`)

- `GET /health`
- `GET /metrics`
- `GET /anomalies`
- `POST /costs/fetch`
- `POST /ingest`
- `GET /dashboard/summary`
- `GET /dashboard/cost-allocation`
- `GET /dashboard/shared-costs`
- `GET /dashboard/unit-economics`
- `GET /dashboard/forecast`
- `GET /dashboard/insights`
- `GET /dashboard/logs`
- `GET /monitor/services`
- `GET /forecast/aws`
- `GET /what-if/simulate`
- `POST /assistant/finops`
- `POST /optimization/ec2/run`
- `POST /chaos/start`
- `POST /chaos/stop`

### ML Service (`ml_service.py`)

- `GET /health`
- `POST /detect`
- `POST /forecast`

## Prerequisites

- Node.js 20+
- Python 3.11+ recommended
- PostgreSQL
- AWS credentials with Cost Explorer access if you want live data

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need.

### Required for backend startup

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### Required for live AWS data

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`

### Optional integrations

- `ML_DETECT_URL`
- `ML_ANOMALY_DETECT_URL`
- `ML_FORECAST_URL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `EC2_INSTANCE_ID`
- `EC2_OPTIMIZATION_INSTANCE_NAMES`
- `EC2_OPTIMIZATION_ACTION`
- `EC2_OPTIMIZATION_AUTO`
- `EC2_OPTIMIZATION_BACKGROUND`
- `EC2_OPTIMIZATION_POLICY_INTERVAL_SECONDS`
- `EC2_OPTIMIZATION_SEARCH_REGIONS`
- `ENABLE_CHAOS_MODE`
- `MAX_CHAOS_INSTANCES`
- `CHAOS_ANOMALY_DELAY_SECONDS`
- `CHAOS_OPTIMIZE_DELAY_SECONDS`
- `AUTOMATION_LOG_READ_LIMIT`
- `UNIT_COUNT`
- `UNIT_TYPE`
- `OPTIMIZATION_EMAIL_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAIL_FROM`
- `EMAIL_TO`

## Local Setup

### 1. Install backend and ML dependencies

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install pandas scikit-learn prophet
```

### 2. Create environment file

```bash
copy .env.example .env
```

### 3. Start the ML service

```bash
uvicorn ml_service:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Start the backend

```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes On Data Flow

- The backend prefers live AWS data but can fall back to `synthetic_costs.json`
- The ML anomaly detect URL defaults to a hosted ngrok endpoint unless overridden in `.env`
- The ML forecast URL defaults to `http://127.0.0.1:8001/forecast`
- Database tables are created on import from `backend/models.py`

## Useful Commands

```bash
# Frontend type-check
cd frontend
npm run lint

# Backend dev server
cd backend
uvicorn main:app --reload

# ML service dev server
uvicorn ml_service:app --reload --port 8001
```

## Existing Project Notes

- [docs.md](C:\Users\Durva S\CloudSense\docs.md)
- [hackathon_report.md](C:\Users\Durva S\CloudSense\hackathon_report.md)
