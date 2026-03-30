"""
Generate realistic synthetic AWS daily cost data (60 days, multiple services).
Outputs synthetic_costs.json and prints summary stats.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta

SERVICES = ["EC2", "S3", "Lambda", "RDS", "API Gateway"]

# Rough daily USD means (UnblendedCost-style) per service — scaled by trend/weekend later
SERVICE_BASE_MEANS = {
    "EC2": 18.0,
    "S3": 2.2,
    "Lambda": 0.45,
    "RDS": 12.0,
    "API Gateway": 0.35,
}

# Std dev as fraction of mean for normal-ish noise
SERVICE_SIGMA_FRAC = {
    "EC2": 0.12,
    "S3": 0.15,
    "Lambda": 0.18,
    "RDS": 0.11,
    "API Gateway": 0.20,
}


def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def main() -> None:
    random.seed()

    end = date.today()
    start = end - timedelta(days=59)
    days = [start + timedelta(days=i) for i in range(60)]

    # Gradual growth: ~12% higher at end vs start
    def growth_factor(day_index: int) -> float:
        return 1.0 + 0.12 * (day_index / 59.0)

    # Weekend: slightly lower (typical dev/test accounts)
    def weekend_factor(d: date) -> float:
        if not _is_weekend(d):
            return 1.0
        return random.uniform(0.62, 0.88)

    # Pick anomaly days (non-overlapping)
    n_spikes = random.randint(5, 8)
    n_drops = random.randint(1, 2)
    pool = list(range(60))
    random.shuffle(pool)
    spike_indices = sorted(pool[:n_spikes])
    remaining = [i for i in pool[n_spikes:] if i not in spike_indices]
    random.shuffle(remaining)
    drop_indices = sorted(remaining[:n_drops])

    spike_mult = {i: random.uniform(2.0, 4.0) for i in spike_indices}
    drop_mult = {i: random.uniform(0.01, 0.06) for i in drop_indices}

    records: list[dict] = []
    anomaly_dates: set[str] = set()

    for idx, d in enumerate(days):
        g = growth_factor(idx)
        w = weekend_factor(d)

        day_mult = 1.0
        if idx in spike_mult:
            day_mult *= spike_mult[idx]
            anomaly_dates.add(d.isoformat())
        if idx in drop_mult:
            day_mult *= drop_mult[idx]
            anomaly_dates.add(d.isoformat())

        for svc in SERVICES:
            mu = SERVICE_BASE_MEANS[svc] * g * w
            sigma = max(0.01, mu * SERVICE_SIGMA_FRAC[svc])
            raw = random.gauss(mu, sigma)
            raw = max(0.0, raw)
            # ±10% daily jitter
            raw *= random.uniform(0.90, 1.10)
            raw *= day_mult
            amount = round(raw, 4)
            records.append(
                {
                    "date": d.isoformat(),
                    "service": svc,
                    "amount": amount,
                }
            )

    out_path = "synthetic_costs.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    print(f"Total records: {len(records)}")
    print(f"Wrote to {out_path}")
    print("Anomaly dates (spike and/or drop):", sorted(anomaly_dates))


if __name__ == "__main__":
    main()
