import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

interface ForecastData {
  avg_daily_cost: number;
  projected_monthly_cost: number;
  trend: string;
  data_points: number;
}

export default function ForecastWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/forecast`)
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
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400">PROJECTED MONTHLY</h2>
      <div className="space-y-0.5">
        <div className="text-6xl font-serif">${data.projected_monthly_cost.toFixed(0)}</div>
        <div className="text-[9px] font-bold text-gray-500 tracking-widest">USD FORECAST</div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60 tracking-widest mt-4">
        <TrendingUp size={12} />
        ${data.avg_daily_cost.toFixed(2)} AVG DAILY
      </div>
    </div>
  );
}
