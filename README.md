# CloudSense

CloudSense is a FinOps-focused cloud cost intelligence platform for tracking AWS spend, detecting anomalies, forecasting future cost trends, and surfacing optimization opportunities through an interactive dashboard.

## Overview

CloudSense combines a React frontend, a FastAPI backend, and a lightweight ML service to help teams understand where cloud spend is going and respond faster when costs drift unexpectedly.

Core capabilities:

- AWS Cost Explorer ingestion with service-level breakdowns
- Cost anomaly detection using Isolation Forest
- Forecasting with Prophet-based time series predictions
- Dashboard views for summary, allocation, shared costs, unit economics, and insights
- What-if simulation endpoints for optimization scenarios
- EC2 optimization workflows and action logging
- FinOps assistant responses powered by Groq or a local fallback summary
- Synthetic fallback dataset support for demos and local development

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Recharts, Lucide React, Tailwind tooling, Motion
- Backend: FastAPI, SQLAlchemy, PostgreSQL, boto3, httpx, python-dotenv
- ML Service: FastAPI, pandas, scikit-learn, Prophet
- Cloud/Data: AWS Cost Explorer, AWS EC2

## Architecture

```text
frontend/        React dashboard and UI workflows
backend/         FastAPI APIs, AWS integration, persistence, automation logic
ml_service.py    Anomaly detection and forecasting service
```

Application flow:

1. The frontend calls the FastAPI backend for metrics, anomalies, analytics, and monitor data.
2. The backend fetches AWS cost data or falls back to `synthetic_costs.json`.
3. The backend calls the ML service for anomaly detection and forecasting.
4. Results are returned to the UI and can trigger optimization or monitoring workflows.

## Repository Structure

```text
.
|-- backend/
|-- frontend/
|-- landing page/
|-- ml_service.py
|-- synthetic_costs.json
|-- generate_synthetic_costs.py
|-- requirements.txt
|-- .env.example
```

The main application lives in `backend/`, `frontend/`, and `ml_service.py`. The `landing page/` directory contains a separate landing-page app variant.

## Features

- Cost monitoring across selectable time windows
- Service-level cost breakdowns
- Forecast visualizations for projected spend
- Anomaly detection and alert surfacing
- Dashboard widgets for allocation, unit cost, and shared-cost analysis
- Optimization action logs for monitoring automated decisions
- FinOps assistant endpoint for cloud spend Q&A
- Chaos/demo support for controlled EC2 workflow testing

## Contributors

| Name | GitHub | Contributions |
|---|---|---|
| Ahana | [@ahana1864](https://github.com/ahana1864) | Frontend, database, landing page |
| Palak | [@palak11245](https://github.com/palak11245) | Backend, AWS integration, customizable dashboard, Monitor Your Services page |
| Durva | [@sykeriin](https://github.com/sykeriin) | AI features, ML analytics, integration, AI assistant, what-if analysis, forecasting, finishing touches |

## API Highlights

### Backend

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

### ML Service

- `GET /health`
- `POST /detect`
- `POST /forecast`

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL
- AWS credentials with Cost Explorer access for live cloud data

### 1. Install Python dependencies

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install pandas scikit-learn prophet
```

### 2. Create the environment file

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

Open `http://localhost:3000` after all services are running.

## Environment Configuration

Copy `.env.example` to `.env` and provide the values required for your setup.

Required backend variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Required for live AWS access:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`

Optional integrations and automation settings:

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

## Development Notes

- The backend can use live AWS data or fall back to `synthetic_costs.json`
- The default ML forecast URL is `http://127.0.0.1:8001/forecast`
- Database tables are created from `backend/models.py`
- The frontend includes the main dashboard plus customizable dashboard components

## Useful Commands

```bash
# Frontend type-check
cd frontend
npm run lint

# Backend
cd backend
uvicorn main:app --reload

# ML service
uvicorn ml_service:app --reload --port 8001
```
