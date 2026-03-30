import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

interface UnitEconomicsData {
  total_cost: number;
  units: number;
  cost_per_unit: number;
  unit_type: string;
}

export default function CostPerUnitWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<UnitEconomicsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/unit-economics`)
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
      <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400">COST PER UNIT</h2>
      <div className="space-y-0.5">
        <div className="text-6xl font-serif">${data.cost_per_unit.toFixed(2)}</div>
        <div className="text-[9px] font-bold text-gray-500 tracking-widest">{data.unit_type.toUpperCase()}</div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60 tracking-widest mt-4">
        <Activity size={12} />
        {data.units.toLocaleString()} UNITS
      </div>
    </div>
  );
}
