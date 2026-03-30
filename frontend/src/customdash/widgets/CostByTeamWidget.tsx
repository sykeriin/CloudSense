import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const API_BASE_URL = 'http://localhost:8000';
const COLORS = ['#f87171', '#ffffff', '#a3a3a3', '#737373'];

interface CostAllocation {
  by_team: Array<{ team: string; total_cost: number }>;
}

export default function CostByTeamWidget({ theme }: { theme: 'light' | 'dark' }) {
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

  if (!data || !data.by_team.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">Cost by Team</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.by_team}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ team, total_cost }) => `${team.toUpperCase()}: $${total_cost.toFixed(0)}`}
              outerRadius="70%"
              fill="#8884d8"
              dataKey="total_cost"
            >
              {data.by_team.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
