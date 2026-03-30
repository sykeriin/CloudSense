import os
from datetime import datetime, timedelta

import boto3
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()

    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if not aws_access_key_id or not aws_secret_access_key:
        print("AWS credentials missing in .env")
        return

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=400)
    start = start_date.isoformat()
    end = end_date.isoformat()

    print(f"Fetching from: {start} to {end}")

    client = boto3.client(
        "ce",
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name="us-east-1",
    )

    response = client.get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
    )

    results = response.get("ResultsByTime", [])
    print("Raw ResultsByTime:", results)
    print(f"Periods returned: {len(results)}")

    if not results:
        print("No cost data returned by Cost Explorer for the requested range.")
        return

    total_cost = 0.0
    for item in results:
        month_start = item["TimePeriod"]["Start"]
        amount = float(item["Total"]["UnblendedCost"]["Amount"])
        total_cost += amount
        print(f"{month_start} -> ${amount}")

    print(f"Total cost: ${total_cost}")


if __name__ == "__main__":
    main()
