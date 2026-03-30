# CloudSense: Cloud Cost Intelligence System

**Hackathon Documentation Pack** | 36 Hours

---

## Table of Contents

1. [Team Roles](#team-roles)
2. [Product Requirements Document (PRD)](#product-requirements-document-prd)
3. [Technical Document](#technical-document)

---

## Team Roles

| Role | Responsibility |
|------|---|
| ML Engineer (You) | Anomaly detection pipeline, IsolationForest, FastAPI `/detect` endpoint |
| AWS Engineer | boto3 integration, Cost Explorer, auto-optimization actions |
| Frontend | React dashboard, live charts, anomaly alerts, action trigger UI |

---

## Product Requirements Document (PRD)

### 1.1 Problem Statement

Organizations running workloads on AWS have no automated way to detect abnormal cost spikes and act on them without human intervention. This project builds a real-time cost intelligence system that monitors live AWS resource usage, detects genuine cost anomalies using ML, and automatically executes optimizations via cloud APIs.

### 1.2 Goals

- Connect to a real AWS free tier account via boto3
- Pull live resource usage and cost data from Cost Explorer and CloudWatch
- Detect cost anomalies using ML (IsolationForest)
- Automatically trigger at least one optimization action (e.g., stop idle EC2 instance)
- Display everything on a live dashboard with anomaly alerts

### 1.3 Non-Goals

- Multi-cloud support (GCP/Azure) — out of scope for this hackathon
- User authentication system
- Historical data beyond what Cost Explorer provides
- Complex ML model tuning — working model > fancy model

### 1.4 Success Criteria

| Criteria | Target |
|----------|--------|
| Live AWS data in dashboard | Real account, not mocked |
| Anomaly detection fires on spike | IsolationForest flags injected spike |
| Auto-optimization executes | EC2 instance stops via API call |
| End-to-end demo flow works | Spike → detect → optimize in one demo run |

### 1.5 Timeline

| Hours | Milestone |
|-------|-----------|
| 0–2 | AWS account live, boto3 pulling Cost Explorer data, team schema agreed |
| 2–8 | ML pipeline on mock data, FastAPI `/detect` endpoint, backend wiring boto3 |
| 8–16 | Frontend showing live cost chart, anomaly flag UI, backend serving real data |
| 16–24 | Full integration: real AWS → ML → frontend. EC2 stop action working. |
| 24–32 | Testing the demo flow. Inject spike, watch detection, trigger optimize. |
| 32–36 | Buffer for bugs. Polish demo script. Do NOT add new features. |

---

## Technical Document

### 2.1 Architecture

Three services, all running locally during the demo:

- **ML Service** — FastAPI on port 8001, Python, IsolationForest
- **Backend Service** — FastAPI on port 8000, Python, boto3, calls ML service
- **Frontend** — React on port 3000, calls Backend only

### 2.2 Data Schema (Agreed Contract)

**Cost Data Object**
```json
{
  "date": "2024-03-01",
  "amount": 12.34
}
```

**Anomaly Result Object**
```json
{
  "date": "2024-03-01",
  "amount": 12.34,
  "anomaly": true,
  "score": -0.42
}
```

**Optimize Request**
```json
{
  "resource_id": "i-0abc12345",
  "action": "stop_ec2"
}
```

**Optimize Response**
```json
{
  "action": "stop_ec2",
  "resource_id": "i-0abc12345",
  "result": "success",
  "timestamp": "..."
}
```

### 2.3 ML Service — `ml_service.py`

**Stack:** Python 3.10+, FastAPI, scikit-learn, pandas, uvicorn

**Run:**
```bash
uvicorn ml_service:app --port 8001 --reload
```

**Endpoint:** `POST /detect`

**Input:** `[{date, amount}]`

**Logic:** StandardScaler → IsolationForest(contamination=0.05) → fit_predict

**Output:** `[{date, amount, anomaly: bool, score: float}]`

**Notes:**
- contamination=0.05 means ~5% of points expected to be anomalous
- Score < 0 = anomaly. More negative = more anomalous.
- Do NOT tune parameters during the hackathon — defaults work fine

### 2.4 Backend Service — `main.py`

**Stack:** Python 3.10+, FastAPI, boto3, httpx (to call ML service), uvicorn

**Run:**
```bash
uvicorn main:app --port 8000 --reload
```

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/costs` | GET | Calls boto3 `ce.get_cost_and_usage()`, returns `[{date, amount}]` |
| `/api/anomalies` | GET | Calls `/api/costs` then POST `ml_service:8001/detect` |
| `/api/optimize` | POST | Calls `ec2.stop_instances(InstanceIds=[resource_id])` |
| `/api/status` | GET | Returns `{connected: true, last_updated: timestamp}` |

**AWS API Calls:**

- `ce.get_cost_and_usage(TimePeriod, Granularity='DAILY', Metrics=['BlendedCost'])`
- `ec2.stop_instances(InstanceIds=['i-xxxx'])` — your demo money shot
- `cloudwatch.get_metric_statistics()` — optional, use only if time allows

### 2.5 Frontend — React

**Stack:** React 18, Vite, Recharts, TailwindCSS

**Run:**
```bash
npm run dev  # (port 3000)
```

**Create:**
```bash
npm create vite@latest frontend -- --template react
```

**Key Files:**

- `src/App.jsx` — main layout, state, polling
- `src/components/CostChart.jsx` — Recharts wrapper
- `src/components/AnomalyCard.jsx` — anomaly display + button
- `src/components/ActionLog.jsx` — action history

**CORS:**
- Backend must have: `app.add_middleware(CORSMiddleware, allow_origins=['*'])`

### 2.6 Local Setup Commands

#### ML Service
```bash
pip install fastapi uvicorn scikit-learn pandas
uvicorn ml_service:app --port 8001 --reload
```

#### Backend
```bash
pip install fastapi uvicorn boto3 httpx python-dotenv
uvicorn main:app --port 8000 --reload
```

#### Frontend
```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install recharts && npm run dev
```
Environment Variables (.env)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=ap-south-1
4.7 Demo Flow Script
Practice this sequence before judging. Do it at least 3 times.
#	Step
1	Open dashboard. Show live green 'Connected to AWS' status.
2	Point to cost chart. Show real AWS data from your account.
3	Manually trigger a cost spike (pre-run a script that adds a spike datapoint).
4	Refresh / wait for poll. Watch the anomaly appear highlighted in red.
5	Anomaly card appears in right panel with score.
6	Click 'Optimize Now'. Show action log update.
7	Go to AWS console (pre-opened tab). Show EC2 instance is now stopped.
8	Done. End-to-end in under 2 minutes.
Critical reminder: Real data, not mocked data. That is what wins.
