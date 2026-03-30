import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../utils';

const API_BASE_URL = 'http://localhost:8000';

interface TotalCostData {
  cost_allocation: {
    by_service: Array<{ service: string; total_cost: number }>;
  };
  forecast: {
    trend: string;
  };
}

export default function TotalCostWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<TotalCostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/summary`)
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

  const totalCost = data.cost_allocation.by_service.reduce((sum, item) => sum + item.total_cost, 0);

  return (
    <div className="h-full flex flex-col justify-between p-5">
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400">TOTAL COST</h2>
      <div className="space-y-0.5">
        <div className="text-6xl font-serif">${totalCost.toFixed(0)}</div>
        <div className="text-[9px] font-bold text-gray-500 tracking-widest">USD ALL TIME</div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60 tracking-widest mt-4">
        {data.forecast.trend === 'increasing' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {data.forecast.trend.toUpperCase()}
      </div>
    </div>
  );
}
