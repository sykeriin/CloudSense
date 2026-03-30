# Hackathon Report

## GitHub Repository

- Repository: [https://github.com/ahana1864/Anastasia](https://github.com/ahana1864/Anastasia)

## APIs Used In The Project

- AWS Cost Explorer API, accessed through `boto3`, to fetch cloud cost data by date and AWS service.
- AWS EC2 API, accessed through `boto3`, to perform anomaly-triggered EC2 actions in the automation flow.
- Groq Chat Completions API at `https://api.groq.com/openai/v1/chat/completions`, used by CloudGuard for the AI FinOps assistant.
- Internal FastAPI backend endpoints such as `/forecast/aws`, `/what-if/simulate`, `/assistant/finops`, `/metrics`, and `/anomalies`.
- Internal ML service endpoints such as `/detect` and `/forecast` for anomaly detection and Prophet-based forecasting.

## Assets Used In The Project

- `synthetic_costs.json` as the fallback/demo cloud-cost dataset.
- `cost_data.json` as a local project data artifact.
- Google Fonts asset: `Alumni Sans`, loaded in the frontend stylesheet.
- Lucide icon assets via `lucide-react`.
- Generated chart visuals rendered through Recharts.

## Libraries Used In The Project

### Backend

- `fastapi`
- `uvicorn`
- `python-dotenv`
- `SQLAlchemy`
- `psycopg2-binary`
- `boto3`
- `httpx`

### Frontend

- `react`
- `react-dom`
- `vite`
- `typescript`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `tailwindcss`
- `clsx`
- `tailwind-merge`
- `lucide-react`
- `recharts`
- `motion`
- `dotenv`
- `express`
- `tsx`
- `autoprefixer`

### ML / Forecasting

- `prophet`
- `pandas`
- `scikit-learn`
- `numpy`

## Components Not Created During The Hackathon

- The base React + Vite project structure.
- Third-party UI/chart/icon systems from external libraries, especially:
  - `recharts`
  - `lucide-react`
  - `tailwindcss`
  - `clsx`
  - `tailwind-merge`
- Google-hosted `Alumni Sans` font.
- AWS SDK/API integrations provided by `boto3`.
- Prophet forecasting library and its underlying modeling framework.

## Notes

- The project supports both live AWS data and a synthetic fallback dataset.
- CloudGuard, the in-app assistant, uses Groq for responses when a valid API key is configured.
