import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { WidgetConfig, METRIC_OPTIONS } from '../types';
import TextBlockWidget from './TextBlockWidget';
import LogsWidget from './LogsWidget';
import CurrentSituationAIWidget from './CurrentSituationAIWidget';

const API_BASE_URL = 'http://127.0.0.1:8000';
const COLORS = ['#f87171', '#ffffff', '#a3a3a3', '#737373', '#525252', '#404040'];

interface WidgetRendererProps {
  config: WidgetConfig;
  theme: 'light' | 'dark';
  onUpdate?: (config: WidgetConfig) => void;
}

export default function WidgetRenderer({ config, theme, onUpdate }: WidgetRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.metric === 'text_block' || config.metric === 'logs' || config.metric === 'ai_current_situation') {
      setLoading(false);
      return;
    }
    fetchData();
  }, [config.metric, config.time_range, config.group_by]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = METRIC_OPTIONS[config.metric].endpoint;
      const params = new URLSearchParams();
      if (config.time_range) params.append('range', config.time_range);
      if (config.group_by && config.group_by !== 'none') params.append('group_by', config.group_by);
      
      const url = `${API_BASE_URL}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || (!data && config.metric !== 'text_block' && config.metric !== 'logs' && config.metric !== 'ai_current_situation')) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  if (config.metric === 'logs') {
    return <LogsWidget theme={theme} />;
  }

  if (config.metric === 'ai_current_situation') {
    return <CurrentSituationAIWidget theme={theme} timeRange={config.time_range} />;
  }

  if (config.metric === 'text_block') {
    return (
      <TextBlockWidget
        content={config.content || ''}
        widgetTitle={config.widgetTitle}
        theme={theme}
        onUpdate={(content, widgetTitle) => {
          if (onUpdate) {
            onUpdate({ ...config, content, widgetTitle });
          }
        }}
      />
    );
  }

  switch (config.visualization) {
    case 'kpi':
      return <KPIWidget config={config} data={data} />;
    case 'line':
      return <LineChartWidget config={config} data={data} theme={theme} />;
    case 'bar':
      return <BarChartWidget config={config} data={data} theme={theme} />;
    case 'pie':
      return <PieChartWidget config={config} data={data} />;
    default:
      return <div>Unknown visualization type</div>;
  }
}

function KPIWidget({ config, data }: { config: WidgetConfig; data: any }) {
  let value = 0;
  let subtitle = '';
  let trend = '';
  let icon = <DollarSign size={12} />;

  switch (config.metric) {
    case 'total_cost':
      value = data.cost_allocation?.by_service?.reduce((sum: number, item: any) => sum + item.total_cost, 0) || 0;
      subtitle = `USD ${config.time_range.toUpperCase()}`;
      trend = data.forecast?.trend || '';
      break;
    case 'forecast':
      value = data.projected_monthly_cost || 0;
      subtitle = 'USD FORECAST';
      trend = data.trend || '';
      icon = <TrendingUp size={12} />;
      break;
    case 'anomalies':
      value = data.potential_savings || 0;
      subtitle = 'FROM ANOMALIES';
      icon = <AlertTriangle size={12} />;
      break;
    default:
      value = 0;
  }

  return (
    <div className="h-full flex flex-col justify-between p-5">
      <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">{config.title?.toUpperCase()}</h2>
      <div className="space-y-0.5">
        <div className="text-8xl font-serif">${value.toFixed(0)}</div>
        <div className="text-[13px] font-bold text-gray-500 tracking-widest">{subtitle}</div>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-[13px] font-bold opacity-60 tracking-widest mt-4">
          {trend === 'increasing' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.toUpperCase()}
        </div>
      )}
      {!trend && (
        <div className="flex items-center gap-1.5 text-[13px] font-bold opacity-60 tracking-widest mt-4">
          {icon}
          {config.time_range.toUpperCase()}
        </div>
      )}
    </div>
  );
}

function LineChartWidget({ config, data, theme }: { config: WidgetConfig; data: any; theme: string }) {
  let chartData: any[] = [];

  if (config.metric === 'cost_trend' && data.by_day) {
    chartData = data.by_day;
  } else if (data.by_day) {
    chartData = data.by_day;
  }

  if (!chartData.length) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-500">No trend data</div>;
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">{config.title}</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fontWeight: 700, fill: theme === 'light' ? '#6b7280' : '#4b5563' }}
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              interval={Math.floor(chartData.length / 5)}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', color: '#fff' }}
            />
            <Line type="monotone" dataKey="total_cost" stroke="#f87171" strokeWidth={2} dot={{ r: 2, fill: '#f87171' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BarChartWidget({ config, data, theme }: { config: WidgetConfig; data: any; theme: string }) {
  let chartData: any[] = [];

  if (config.group_by === 'service' && data.by_service) {
    chartData = data.by_service.slice(0, 8);
  } else if (config.group_by === 'team' && data.by_team) {
    chartData = data.by_team;
  } else if (config.group_by === 'date' && data.by_day) {
    chartData = data.by_day.slice(-10);
  } else {
    switch (config.metric) {
      case 'cost_by_service':
        chartData = data.by_service?.slice(0, 8) || [];
        break;
      case 'cost_by_team':
        chartData = data.by_team || [];
        break;
      case 'shared_costs':
        chartData = data.distribution || [];
        break;
      case 'total_cost':
        chartData = data.cost_allocation?.by_service?.slice(0, 8) || [];
        break;
      case 'forecast':
        chartData = [{ name: 'Projected', value: data.projected_monthly_cost || 0 }];
        break;
      case 'cost_trend':
        chartData = data.by_day?.slice(-10) || [];
        break;
    }
  }

  if (!chartData.length) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-500">No data</div>;
  }

  const dataKey = chartData[0]?.total_cost !== undefined ? 'total_cost' : 
                   chartData[0]?.value !== undefined ? 'value' : 'total_cost';
  const nameKey = chartData[0]?.service !== undefined ? 'service' :
                  chartData[0]?.team !== undefined ? 'team' :
                  chartData[0]?.date !== undefined ? 'date' :
                  chartData[0]?.name !== undefined ? 'name' : 'service';

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">{config.title}</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -35, bottom: 0 }}>
            <XAxis 
              dataKey={nameKey}
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fontWeight: 700, fill: theme === 'light' ? '#6b7280' : '#4b5563' }}
              tickFormatter={(value) => {
                if (nameKey === 'date') {
                  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
                return value;
              }}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', color: '#fff' }}
            />
            <Bar 
              dataKey={dataKey}
              fill={theme === 'light' ? "#000000" : "#ffffff"} 
              radius={[1, 1, 0, 0]} 
              barSize={24}
              fillOpacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PieChartWidget({ config, data }: { config: WidgetConfig; data: any }) {
  let chartData: any[] = [];

  if (config.group_by === 'service' && data.by_service) {
    chartData = data.by_service.slice(0, 6);
  } else if (config.group_by === 'team' && data.by_team) {
    chartData = data.by_team;
  } else {
    switch (config.metric) {
      case 'cost_by_service':
        chartData = data.by_service?.slice(0, 6) || [];
        break;
      case 'cost_by_team':
        chartData = data.by_team || [];
        break;
    }
  }

  if (!chartData.length) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-500">No data</div>;
  }

  const dataKey = 'total_cost';
  const nameKey = chartData[0]?.service !== undefined ? 'service' : 'team';

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">{config.title}</h2>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry[nameKey].toUpperCase()}: ${entry[dataKey].toFixed(0)}`}
              outerRadius="70%"
              dataKey={dataKey}
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
