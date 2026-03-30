import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { API_BASE_URL } from '../../config/api';

interface CostAllocation {
  by_day: Array<{ date: string; total_cost: number }>;
}

export default function CostTrendWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<CostAllocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/cost-allocation`)
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

  if (!data || !data.by_day.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  const last30Days = data.by_day.slice(-30);

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">Cost Trend (Last 30 Days)</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={last30Days}>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 7, fontWeight: 700, fill: theme === 'light' ? '#6b7280' : '#4b5563' }}
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              interval={4}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: '#fff' }}
              labelFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <Line 
              type="monotone" 
              dataKey="total_cost" 
              stroke="#f87171" 
              strokeWidth={2} 
              dot={{ r: 2, fill: '#f87171' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
