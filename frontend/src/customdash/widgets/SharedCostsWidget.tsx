import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const API_BASE_URL = 'http://localhost:8000';

interface SharedCosts {
  total_shared_cost: number;
  distribution: Array<{
    team: string;
    direct_cost: number;
    allocated_shared_cost: number;
    total_cost: number;
  }>;
}

export default function SharedCostsWidget({ theme }: { theme: 'light' | 'dark' }) {
  const [data, setData] = useState<SharedCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/dashboard/shared-costs`)
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

  if (!data || !data.distribution.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">Shared Costs Distribution</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.distribution} margin={{ top: 5, right: 5, left: -35, bottom: 0 }}>
            <XAxis 
              dataKey="team" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 7, fontWeight: 700, fill: theme === 'light' ? '#6b7280' : '#4b5563' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: '#fff' }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle" 
              wrapperStyle={{ fontSize: '7px', fontWeight: 700, paddingBottom: '5px' }}
            />
            <Bar 
              dataKey="direct_cost" 
              stackId="a"
              name="DIRECT" 
              fill={theme === 'light' ? "#000000" : "#ffffff"} 
              barSize={24}
              fillOpacity={0.8}
            />
            <Bar 
              dataKey="allocated_shared_cost" 
              stackId="a"
              name="SHARED" 
              fill="#f87171" 
              radius={[1, 1, 0, 0]} 
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
