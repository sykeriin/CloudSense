from typing import List

import pandas as pd
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

try:
    from prophet import Prophet
except ImportError:  # pragma: no cover - runtime dependency guard
    Prophet = None


class ForecastRequest(BaseModel):
    data: List[dict] = Field(default_factory=list)
    periods: int = Field(default=7, ge=1, le=365)
    freq: str = Field(default="D")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _prepare_timeseries(data: List[dict]) -> pd.DataFrame:
    df = pd.DataFrame(data)
    if df.empty:
        raise HTTPException(status_code=400, detail="No input rows were provided.")
    if "date" not in df.columns or "amount" not in df.columns:
        raise HTTPException(status_code=400, detail="Each row must include 'date' and 'amount'.")

    grouped = (
        df.assign(date=pd.to_datetime(df["date"], errors="coerce"))
        .dropna(subset=["date"])
        .groupby("date", as_index=False)["amount"]
        .sum()
        .sort_values("date")
    )

    if grouped.empty:
        raise HTTPException(status_code=400, detail="No valid dated rows were provided.")

    grouped = grouped.rename(columns={"date": "ds", "amount": "y"})
    grouped["y"] = grouped["y"].astype(float)
    return grouped


def _prepare_service_timeseries(data: List[dict]) -> dict[str, pd.DataFrame]:
    df = pd.DataFrame(data)
    if df.empty:
        raise HTTPException(status_code=400, detail="No input rows were provided.")
    if "date" not in df.columns or "amount" not in df.columns:
        raise HTTPException(status_code=400, detail="Each row must include 'date' and 'amount'.")

    if "service" not in df.columns:
        return {"all_services": _prepare_timeseries(data)}

    df["service"] = df["service"].fillna("unassigned").astype(str)
    grouped_frames: dict[str, pd.DataFrame] = {}

    for service_name, service_df in df.groupby("service", dropna=False):
        history = _prepare_timeseries(service_df.to_dict(orient="records"))
        if len(history) < 2:
            continue
        grouped_frames[service_name] = history

    if grouped_frames:
        return grouped_frames

    fallback = _prepare_timeseries(data)
    if len(fallback) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least two valid dated rows are required to generate a forecast.",
        )
    return {"all_services": fallback}


def _fit_and_predict(history: pd.DataFrame, periods: int, freq: str) -> tuple[list[dict], list[dict]]:
    if len(history) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least two valid dated rows are required to generate a forecast.",
        )

    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=True,
        yearly_seasonality=True,
    )
    model.fit(history)

    future = model.make_future_dataframe(periods=periods, freq=freq)
    prediction = model.predict(future)

    forecast_frame = prediction[["ds", "yhat", "yhat_lower", "yhat_upper", "trend"]].copy()
    for column in ("yhat", "yhat_lower", "yhat_upper", "trend"):
        forecast_frame[column] = forecast_frame[column].clip(lower=0.0)
    forecast_frame["ds"] = forecast_frame["ds"].dt.strftime("%Y-%m-%d")

    history_rows = history.copy()
    history_rows["ds"] = history_rows["ds"].dt.strftime("%Y-%m-%d")

    return (
        history_rows.to_dict(orient="records"),
        forecast_frame.to_dict(orient="records"),
    )


@app.post("/detect")
def detect(data: List[dict] = Body(...)):
    df = pd.DataFrame(data)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(df[["amount"]])

    model = IsolationForest(contamination=0.05, random_state=42)
    df["anomaly"] = model.fit_predict(scaled)
    df["score"] = model.decision_function(scaled)
    df["anomaly"] = df["anomaly"].map({-1: True, 1: False})
    df["should_optimize"] = df["score"] < -0.1

    return df.to_dict(orient="records")


@app.post("/forecast")
def forecast(request: ForecastRequest):
    if Prophet is None:
        raise HTTPException(
            status_code=500,
            detail="Prophet is not installed. Add 'prophet' to the Python environment first.",
        )

    service_histories = _prepare_service_timeseries(request.data)
    service_forecasts = []

    for service_name, history in service_histories.items():
        history_rows, forecast_rows = _fit_and_predict(history, request.periods, request.freq)
        service_forecasts.append(
            {
                "service": service_name,
                "history": history_rows,
                "forecast": forecast_rows,
            }
        )

    return {
        "services": service_forecasts,
        "periods": request.periods,
        "freq": request.freq,
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "prophet_available": Prophet is not None,
    }
