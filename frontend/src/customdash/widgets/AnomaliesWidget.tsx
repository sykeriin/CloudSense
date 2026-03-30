import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

interface AnomalyInsights {
  anomalies_detected: Array<any>;
  total_anomaly_cost: number;
  potential_savings: number;
  anomaly_count: number;
}

export default function AnomaliesWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<AnomalyInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/insights`)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between p-5">
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400">POTENTIAL SAVINGS</h2>
      <div className="space-y-0.5">
        <div className="text-6xl font-serif text-[var(--color-accent-coral)]">${data.potential_savings.toFixed(0)}</div>
        <div className="text-[9px] font-bold text-gray-500 tracking-widest">FROM ANOMALIES</div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60 tracking-widest mt-4">
        <AlertTriangle size={12} />
        {data.anomaly_count} ANOMALIES
      </div>
    </div>
  );
}
