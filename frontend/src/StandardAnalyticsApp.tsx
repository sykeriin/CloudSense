/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Send,
  RefreshCw,
  Sun,
  TrendingDown,
  User,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

type Theme = 'light' | 'dark';
type View = 'dashboard' | 'monitor' | 'forecast' | 'simulator' | 'assistant';
type DataMode = 'aws' | 'fallback';
type DashboardAggregate = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type DashboardTimeFrame = '7 DAYS' | '30 DAYS' | 'YTD';
type TimeFrame = 'today' | 'past_one_week' | 'past_one_month' | 'past_one_year';

type DashboardFilters = {
  aggregate: DashboardAggregate;
  timeFrame: DashboardTimeFrame;
  services: string[];
};

type ForecastFilters = {
  timeFrame: TimeFrame;
  services: string[];
};

type ForecastPoint = {
  ds: string;
  y: number;
};

type ForecastPrediction = {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  trend: number;
};

type ForecastService = {
  service: string;
  history: ForecastPoint[];
  forecast: ForecastPrediction[];
};

type ForecastResponse = {
  data_source?: string;
  time_frame: TimeFrame;
  periods: number;
  available_services: string[];
  selected_services: string[];
  history_start_date: string;
  history_end_date: string;
  services: ForecastService[];
};

type SimulatorAction = 'resize_instance' | 'delete_volume' | 'schedule_off_hours' | 'purchase_savings_plan';

type SimulatorResponse = {
  data_source?: string;
  time_frame: TimeFrame;
  service: string;
  action: SimulatorAction;
  applied_reduction_percent: number;
  projected_monthly_cost: number;
  estimated_monthly_saving: number;
  optimized_monthly_cost: number;
  trend_ratio: number;
  history_days: number;
  history_start_date: string;
  history_end_date: string;
  available_services: string[];
  history: Array<{ date: string; amount: number }>;
  explanation: string;
};

type AssistantSummaryItem = {
  service: string;
  total_cost: number;
  share: number;
};

type AssistantResponse = {
  provider: string;
  model: string;
  data_source?: string;
  question: string;
  answer: string;
  time_frame: TimeFrame;
  selected_services: string[];
  available_services: string[];
  history_start_date: string;
  history_end_date: string;
  summary: {
    total_cost: number;
    average_daily_cost: number;
    peak_day: string | null;
    peak_day_cost: number;
    total_records: number;
    top_services: AssistantSummaryItem[];
  };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type MonitorService = {
  service: string;
  total_cost: number;
  record_count: number;
  last_seen: string;
  status: string;
};

type MonitorLog = {
  action: string;
  service: string;
  status: string;
  message: string;
  recorded_at?: string;
};

type MonitorReasoning = {
  title: string;
  detail: string;
  kind: string;
};

type MonitorResponse = {
  data_source?: string;
  time_frame: TimeFrame;
  active_services: MonitorService[];
  automation_logs: MonitorLog[];
  optimization_reasoning: MonitorReasoning[];
  service_count: number;
  history_start_date: string;
  history_end_date: string;
};

const DASHBOARD_SERVICE_IDS = ['ec2', 's3', 'rds', 'lambda', 'dynamodb', 'cloudfront', 'route53', 'elasticache', 'vpc'];
const TIME_FRAME_OPTIONS: Array<{ value: TimeFrame; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'past_one_week', label: 'Past 1 Week' },
  { value: 'past_one_month', label: 'Past 1 Month' },
  { value: 'past_one_year', label: 'Past 1 Year' },
];

const DASHBOARD_TO_API_TIMEFRAME: Record<DashboardTimeFrame, TimeFrame> = {
  '7 DAYS': 'past_one_week',
  '30 DAYS': 'past_one_month',
  YTD: 'past_one_year',
};
const MIN_VISIBLE_COST_TOTAL = 0.01;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const moneyPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dateStamp = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
const timeStamp = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return money.format(0);
  return Math.abs(value) > 0 && Math.abs(value) < 0.01 ? moneyPrecise.format(value) : money.format(value);
}

function selectSurfaceStyle(theme: Theme) {
  return {
    backgroundColor: theme === 'light' ? '#fffdf8' : '#18181b',
    color: theme === 'light' ? '#16120d' : '#f9fafb',
  };
}

const optimizationData = [
  { name: 'EC2', optimized: 890, savings: 350 },
  { name: 'S3', optimized: 410, savings: 110 },
  { name: 'RDS', optimized: 720, savings: 260 },
  { name: 'Lambda', optimized: 150, savings: 60 },
  { name: 'DynamoDB', optimized: 280, savings: 60 },
];

const reportDataByAggregate = {
  DAILY: Array.from({ length: 24 }, (_, index) => ({ day: `${index}:00`, value: 20 + Math.random() * 40, alert: index === 14 })),
  WEEKLY: [
    { day: 'MON', value: 45 },
    { day: 'TUE', value: 52 },
    { day: 'WED', value: 85, alert: true },
    { day: 'THU', value: 48 },
    { day: 'FRI', value: 55 },
    { day: 'SAT', value: 42 },
    { day: 'SUN', value: 38 },
  ],
  MONTHLY: [
    { day: 'WK 1', value: 240 },
    { day: 'WK 2', value: 310 },
    { day: 'WK 3', value: 280 },
    { day: 'WK 4', value: 350, alert: true },
  ],
};

const servicesSeed = [
  { id: 'ec2', name: 'EC2 Compute', cost: 1842 },
  { id: 's3', name: 'S3 Storage', cost: 412 },
  { id: 'rds', name: 'RDS Database', cost: 926 },
  { id: 'lambda', name: 'Lambda', cost: 156 },
  { id: 'dynamodb', name: 'DynamoDB', cost: 284 },
  { id: 'cloudfront', name: 'CloudFront', cost: 198 },
  { id: 'route53', name: 'Route 53', cost: 45 },
  { id: 'elasticache', name: 'ElastiCache', cost: 312 },
  { id: 'vpc', name: 'VPC Networking', cost: 88 },
];

function generateChartBars(aggregate: DashboardAggregate) {
  const length = aggregate === 'DAILY' ? 24 : aggregate === 'WEEKLY' ? 7 : 4;
  return Array.from({ length }, () => ({ value: 20 + Math.random() * 60, isAnomaly: Math.random() > 0.9 }));
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const { detail } = body;
    if (typeof detail === 'string' && detail.trim()) {
      return `Request failed (${response.status}): ${detail}`;
    }
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && detail[0] !== null && 'msg' in detail[0]) {
      return `Request failed (${response.status}): ${String((detail[0] as { msg: string }).msg)}`;
    }
  } catch {
    /* ignore non-JSON */
  }
  return `Request failed with status ${response.status}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(await readApiErrorMessage(response));
  return response.json() as Promise<T>;
}

/** Tries dashboard-scoped path first (matches /dashboard/logs), then legacy /monitor/services. */
async function apiGetMonitor(query: string): Promise<MonitorResponse> {
  const candidates = [`/dashboard/monitor/services?${query}`, `/monitor/services?${query}`];
  let lastStatus: number | undefined;
  for (const path of candidates) {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (response.ok) {
      return response.json() as Promise<MonitorResponse>;
    }
    lastStatus = response.status;
    if (response.status !== 404) {
      throw new Error(await readApiErrorMessage(response));
    }
  }
  throw new Error(
    `Monitor API returned ${lastStatus ?? '404'}. Stop and restart the API from the backend folder so it loads the latest code (e.g. uvicorn main:app --reload --host 127.0.0.1 --port 8000).`,
  );
}

function appendDataMode(params: URLSearchParams, dataMode: DataMode) {
  if (dataMode === 'fallback') {
    params.set('force_fallback', 'true');
  } else {
    params.set('strict_aws', 'true');
  }
}

function toForecastQuery(filters: ForecastFilters, periods: number, dataMode: DataMode) {
  const params = new URLSearchParams();
  params.set('time_frame', filters.timeFrame);
  params.set('periods', String(periods));
  for (const service of filters.services) params.append('services', service);
  appendDataMode(params, dataMode);
  return params.toString();
}

function buildServiceSummary(service: ForecastService) {
  const historyTotal = service.history.reduce((sum, point) => sum + point.y, 0);
  const forecastOnly = service.forecast.slice(service.history.length);
  const projectedTotal = forecastOnly.reduce((sum, point) => sum + point.yhat, 0);
  const latestHistory = service.history.at(-1)?.y ?? 0;
  const earliestHistory = service.history[0]?.y ?? latestHistory;
  const trend = earliestHistory === 0 ? 0 : ((latestHistory - earliestHistory) / Math.abs(earliestHistory || 1)) * 100;
  return {
    ...service,
    historyTotal,
    projectedTotal,
    latestHistory,
    trend,
    miniSeries: service.history.slice(-7).map((point) => ({ label: shortDate.format(new Date(point.ds)), value: point.y })),
  };
}

function aggregateDashboardSeries(
  services: ForecastService[],
  aggregate: DashboardAggregate,
): Array<{ day: string; value: number; alert?: boolean }> {
  const dailyMap = new Map<string, number>();
  for (const service of services) {
    for (const point of service.history) {
      dailyMap.set(point.ds, (dailyMap.get(point.ds) || 0) + point.y);
    }
  }

  const entries = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalAverage = entries.reduce((sum, [, value]) => sum + value, 0) / Math.max(entries.length, 1);

  if (aggregate === 'DAILY') {
    return entries.slice(-14).map(([date, value]) => ({
      day: shortDate.format(new Date(date)),
      value,
      alert: value > totalAverage * 1.5,
    }));
  }

  if (aggregate === 'WEEKLY') {
    const grouped = new Map<string, number>();
    for (const [date, value] of entries) {
      const label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(date)).toUpperCase();
      grouped.set(label, (grouped.get(label) || 0) + value);
    }
    return [...grouped.entries()].map(([day, value]) => ({ day, value, alert: value > totalAverage * 3 }));
  }

  const monthGroups = new Map<string, number>();
  for (const [date, value] of entries) {
    const stamp = new Date(date);
    const label = `${stamp.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${stamp.getDate() <= 7 ? 'WK 1' : stamp.getDate() <= 14 ? 'WK 2' : stamp.getDate() <= 21 ? 'WK 3' : 'WK 4'}`;
    monthGroups.set(label, (monthGroups.get(label) || 0) + value);
  }
  return [...monthGroups.entries()].slice(-4).map(([day, value]) => ({ day, value, alert: value > totalAverage * 5 }));
}

function hasMeaningfulSpend(total: number) {
  return Math.abs(total) >= MIN_VISIBLE_COST_TOTAL;
}

function MiniChart({
  data,
  color = 'var(--color-accent-neutral)',
}: {
  data: Array<{ value: number; isAnomaly?: boolean; label?: string }>;
  color?: string;
}) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <Bar dataKey="value" radius={[1, 1, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`${entry.label || 'bar'}-${index}`} fill={entry.isAnomaly ? '#f87171' : color} fillOpacity={entry.isAnomaly ? 1 : 0.25} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const VIEW_COPY: Record<View, { eyebrow: string; title: string; blurb: string }> = {
  dashboard: { eyebrow: 'Dashboard', title: 'Overview', blurb: 'Core spend and optimization views' },
  monitor: { eyebrow: 'Standard analytics', title: 'Monitor your services', blurb: 'All active services, automation optimisation logs, and optimization reasoning' },
  forecast: { eyebrow: 'Forecast', title: 'Forecast Overview', blurb: 'Historical plus projected service trends' },
  simulator: { eyebrow: 'What-If Simulator', title: 'What-If Simulator', blurb: 'Monthly savings scenarios from recent history' },
  assistant: { eyebrow: 'CloudGuard', title: 'CloudGuard', blurb: 'Ask questions about AI cloud usage and cost behavior' },
};

function Sidebar({
  theme,
  view,
  setView,
  collapsed,
  toggleCollapsed,
  dataMode,
  toggleDataMode,
}: {
  theme: Theme;
  view: View;
  setView: (view: View) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
  dataMode: DataMode;
  toggleDataMode: () => void;
}) {
  const items: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'monitor', label: 'Monitor your services', icon: Activity },
    { id: 'forecast', label: 'Forecast', icon: BarChart3 },
    { id: 'simulator', label: 'What-If', icon: Calculator },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
  ];

  return (
    <aside className={cn('rounded-2xl border border-black/5 dark:border-white/5 p-4 flex flex-col shadow-sm transition-all duration-300 w-full lg:shrink-0', collapsed ? 'lg:w-24' : 'lg:w-64', theme === 'light' ? 'bg-[#fbfaf6]' : 'bg-[#121212]')}>
      <div className={cn('flex items-center px-2 py-1', collapsed ? 'justify-center' : 'justify-between gap-3')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className={cn('w-9 h-9 border-2 flex items-center justify-center rounded-md shrink-0', theme === 'light' ? 'border-black' : 'border-white')}>
            <div className={cn('w-2.5 h-2.5', theme === 'light' ? 'bg-black' : 'bg-white')} />
          </div>
          {!collapsed && (
            <div>
              <div className="text-[1.8rem] leading-none font-medium tracking-tight">CloudSense</div>
              <div className="text-[11px] font-bold tracking-[0.25em] text-gray-500 uppercase">Control Center</div>
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-8 lg:grid-cols-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn('w-full rounded-xl px-3 py-3 flex items-center text-left transition-colors border', collapsed ? 'justify-center' : 'gap-3', active ? theme === 'light' ? 'bg-black text-white border-black' : 'bg-white text-black border-white' : theme === 'light' ? 'border-black/5 hover:bg-black/5' : 'border-white/5 hover:bg-white/5')}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && (
                <div>
                  <div className="text-xl font-bold leading-none">{item.label}</div>
                  <div className={cn('text-[11px] font-bold tracking-[0.2em] uppercase mt-1', active ? 'opacity-70' : 'text-gray-500')}>
                    {item.id === 'dashboard' ? 'Core view' : item.id === 'monitor' ? 'Services & automation' : item.id === 'forecast' ? 'Prophet' : item.id === 'simulator' ? 'Savings' : 'Groq'}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto space-y-3">
        <button
          onClick={toggleDataMode}
          className={cn('w-full rounded-xl border transition-colors', collapsed ? 'px-0 py-3 flex items-center justify-center' : 'px-4 py-3 text-left', theme === 'light' ? 'border-black/10 bg-[#f5f5f5] hover:bg-black/5' : 'border-white/10 bg-white/5 hover:bg-white/10')}
          title={collapsed ? (dataMode === 'aws' ? 'Using live AWS data' : 'Using fallback data') : undefined}
        >
          {collapsed ? (
            <div className={cn('w-3.5 h-3.5 rounded-full', dataMode === 'aws' ? 'bg-emerald-500' : 'bg-amber-400')} />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Data Mode</div>
                <div className="mt-1 text-lg font-serif">{dataMode === 'aws' ? 'Live AWS' : 'Fallback'}</div>
              </div>
              <div className={cn('rounded-full px-3 py-1 text-[11px] font-bold tracking-widest uppercase', dataMode === 'aws' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-400')}>
                {dataMode === 'aws' ? 'AWS' : 'Demo'}
              </div>
            </div>
          )}
        </button>

        {!collapsed && (
          <div className={cn('rounded-xl border p-4', theme === 'light' ? 'border-black/10 bg-[#f5f5f5]' : 'border-white/10 bg-white/5')}>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Workspace</div>
            <div className="mt-2 text-xl font-serif">AWS cost monitoring</div>
            <div className="mt-1 text-[12px] font-bold tracking-widest text-gray-500 uppercase">Dashboard, forecast, simulator, assistant</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopBar({ theme, view, toggleTheme, onOpenProfile }: { theme: Theme; view: View; toggleTheme: () => void; onOpenProfile?: () => void }) {
  const copy = VIEW_COPY[view];

  return (
    <header className="flex flex-col gap-4 shrink-0 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="text-[12px] font-bold tracking-[0.35em] uppercase text-gray-500">
          {copy.eyebrow}
        </div>
        <h1 className="text-[2.2rem] leading-none font-serif font-light sm:text-[2.8rem] xl:text-[3.45rem]">
          {copy.title}
        </h1>
        <div className="mt-2 text-[15px] font-semibold tracking-wide text-gray-500">{copy.blurb}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold tracking-widest text-gray-500 lg:justify-end">
        <div className="min-w-0 lg:text-right">
          <div className="text-[1.8rem] leading-none font-serif font-light opacity-40 sm:text-[2.3rem] xl:text-[2.8rem]">{timeStamp.format(new Date())}</div>
          <div className="text-[1rem] font-bold tracking-widest uppercase opacity-60">{dateStamp.format(new Date())}</div>
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          {theme === 'light' ? <Moon size={18} className="text-black" /> : <Sun size={18} className="text-white" />}
        </button>
        <button
          type="button"
          onClick={onOpenProfile}
          className={cn('flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5', theme === 'light' ? 'text-black' : 'text-white')}
        >
          <span className="text-base tracking-[0.2em]">DURVA SHARMA</span>
          <div className="w-9 h-9 rounded-full bg-zinc-800/20 dark:bg-zinc-800 flex items-center justify-center">
            <User size={16} />
          </div>
        </button>
      </div>
    </header>
  );
}

function DashboardFilterDropdown({
  theme,
  filters,
  onFilterChange,
  align = 'down',
}: {
  theme: Theme;
  filters: DashboardFilters;
  onFilterChange: (value: DashboardFilters) => void;
  align?: 'up' | 'down';
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleService = (serviceId: string) => {
    const next = filters.services.includes(serviceId)
      ? filters.services.filter((id) => id !== serviceId)
      : [...filters.services, serviceId];
    onFilterChange({ ...filters, services: next });
  };

  return (
    <div className="relative z-30">
      <button onClick={() => setIsOpen((value) => !value)} className="flex items-center gap-2 text-[12px] font-bold tracking-[0.25em] text-gray-500 border border-black/10 dark:border-gray-800 rounded-full px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <Filter size={12} />
        FILTER
      </button>

      {isOpen && (
        <div className={cn('absolute right-0 w-52 rounded-xl shadow-2xl border border-black/15 dark:border-white/15 p-4 z-[200] backdrop-blur-sm', align === 'up' ? 'bottom-full mb-3' : 'top-full mt-3', theme === 'light' ? 'bg-[#fffdf8] text-black' : 'bg-[#18181b] text-white')}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-1.5">Aggregate</label>
              <select value={filters.aggregate} onChange={(event) => onFilterChange({ ...filters, aggregate: event.target.value as DashboardAggregate })} style={selectSurfaceStyle(theme)} className={cn('w-full text-[14px] font-bold border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none', theme === 'light' ? 'text-black' : 'text-white')}>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-1.5">Time Frame</label>
              <select value={filters.timeFrame} onChange={(event) => onFilterChange({ ...filters, timeFrame: event.target.value as DashboardTimeFrame })} style={selectSurfaceStyle(theme)} className={cn('w-full text-[14px] font-bold border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none', theme === 'light' ? 'text-black' : 'text-white')}>
                <option value="7 DAYS">7 DAYS</option>
                <option value="30 DAYS">30 DAYS</option>
                <option value="YTD">YTD</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-1.5">Services</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {DASHBOARD_SERVICE_IDS.map((id) => (
                  <label key={id} className={cn('flex items-center gap-2.5 text-[12px] font-bold uppercase', theme === 'light' ? 'text-black' : 'text-white')}>
                    <input type="checkbox" checked={filters.services.includes(id)} onChange={() => toggleService(id)} className="w-3.5 h-3.5 rounded border-gray-300" />
                    <span>{id}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardView({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardForecast, setDashboardForecast] = useState<ForecastResponse | null>(null);
  const [dashboardLogs, setDashboardLogs] = useState<MonitorLog[]>([]);
  const [servicePageIndex, setServicePageIndex] = useState(0);
  const [optimizationFilters, setOptimizationFilters] = useState<DashboardFilters>({ aggregate: 'WEEKLY', timeFrame: '30 DAYS', services: ['ec2', 's3', 'rds', 'lambda', 'dynamodb'] });
  const [monitorFilters, setMonitorFilters] = useState<DashboardFilters>({ aggregate: 'DAILY', timeFrame: '30 DAYS', services: [...DASHBOARD_SERVICE_IDS] });
  const [reportFilters, setReportFilters] = useState<DashboardFilters>({ aggregate: 'WEEKLY', timeFrame: '30 DAYS', services: ['ec2', 's3', 'rds', 'lambda', 'dynamodb'] });

  const loadDashboardData = async (timeFrame: DashboardTimeFrame = monitorFilters.timeFrame) => {
    const apiTimeFrame = DASHBOARD_TO_API_TIMEFRAME[timeFrame];
    const [forecastResponse, monitorResponse] = await Promise.all([
      apiGet<ForecastResponse>(`/forecast/aws?${toForecastQuery({ timeFrame: apiTimeFrame, services: [] }, 1, dataMode)}`),
      apiGetMonitor(
        (() => {
          const params = new URLSearchParams();
          params.set('time_frame', apiTimeFrame);
          appendDataMode(params, dataMode);
          return params.toString();
        })(),
      ),
    ]);

    setDashboardForecast(forecastResponse);
    setDashboardLogs(monitorResponse.automation_logs || []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadDashboardData();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
      }
    };
    void run();
  }, [dataMode, monitorFilters.timeFrame]);

  const dashboardServiceSummaries = useMemo(
    () =>
      (dashboardForecast?.services || [])
        .map(buildServiceSummary)
        .sort((a, b) => b.historyTotal - a.historyTotal),
    [dashboardForecast],
  );

  const filteredMonitorServices = useMemo(() => {
    const selected = monitorFilters.services;
    return dashboardServiceSummaries
      .filter((service) => selected.length === 0 || selected.some((entry) => service.service.toLowerCase().includes(entry)))
      .map((service) => ({
        id: service.service,
        name: service.service,
        cost: service.latestHistory,
        data: service.miniSeries.map((point) => ({ value: point.value, label: point.label })),
      }));
  }, [dashboardServiceSummaries, monitorFilters.services]);

  const totalSpend = dashboardServiceSummaries.reduce((sum, service) => sum + service.historyTotal, 0);
  const latestProjected = dashboardServiceSummaries.reduce((sum, service) => sum + service.projectedTotal, 0);

  const filteredOptimizationData = useMemo(() => {
    return dashboardServiceSummaries
      .filter((service) => {
        if (!optimizationFilters.services.length) return true;
        return optimizationFilters.services.some((entry) => service.service.toLowerCase().includes(entry));
      })
      .slice(0, 6)
      .map((service) => {
        const baseline = Math.max(0, service.historyTotal);
        const savings = baseline * 0.18;
        return {
          name: service.service,
          optimized: Math.max(0, baseline - savings),
          savings,
        };
      });
  }, [dashboardServiceSummaries, optimizationFilters.services]);

  const reportData = useMemo(() => {
    return aggregateDashboardSeries(dashboardForecast?.services || [], reportFilters.aggregate);
  }, [dashboardForecast, reportFilters.aggregate]);

  const totalPages = Math.max(1, Math.ceil(filteredMonitorServices.length / 3));
  const currentServices = filteredMonitorServices.slice(servicePageIndex * 3, (servicePageIndex + 1) * 3);
  const visibleDashboardLogs = dashboardLogs.slice(0, 5);

  useEffect(() => {
    setServicePageIndex((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  return (
    <div className="h-full min-h-0 grid grid-cols-1 gap-3 overflow-visible lg:grid-rows-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-400" /><span>{error}</span></div>}
      <div className="grid grid-cols-1 gap-3 min-h-0 overflow-visible xl:grid-cols-12">
        <div className={cn('rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between overflow-hidden transition-transform duration-200 hover:scale-[1.015] xl:col-span-3', theme === 'light' ? 'bg-[#e5e5e5]' : 'bg-[#2a2422]')}>
          <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">TOTAL SPEND</h2>
          <div className="space-y-0.5">
            <div className="text-5xl font-serif sm:text-6xl xl:text-7xl">{formatCurrency(totalSpend)}</div>
            <div className="text-[14px] font-bold text-gray-500 tracking-widest">{dashboardForecast ? `${dashboardForecast.history_start_date} to ${dashboardForecast.history_end_date}` : 'Loading'}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[14px] font-bold opacity-60 tracking-widest mt-4">
            <TrendingDown size={12} />
            {formatCurrency(latestProjected)} NEXT PERIOD
          </div>
        </div>

        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015] xl:col-span-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Optimization Impact</h2>
            <DashboardFilterDropdown theme={theme} filters={optimizationFilters} onFilterChange={setOptimizationFilters} />
          </div>
          <div className="flex-grow w-full min-h-0">
            {filteredOptimizationData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredOptimizationData} margin={{ top: 5, right: 5, left: -35, bottom: 0 }} barGap={0}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                  <YAxis axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: '#fff' }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '7px', fontWeight: 700, paddingBottom: '5px' }} />
                  <Bar dataKey="optimized" stackId="a" name="CURRENT BASELINE" fill="#f87171" barSize={24} />
                  <Bar dataKey="savings" stackId="a" name="POTENTIAL SAVINGS" fill={theme === 'light' ? '#000000' : '#ffffff'} radius={[1, 1, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-[15px] font-semibold text-gray-500 px-6">
                No meaningful spend in this window, so there is no honest optimization chart to show.
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col min-h-0 transition-transform duration-200 hover:scale-[1.015] xl:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Log Panel</h2>
              <div className="mt-1 text-[13px] text-gray-500">Recent optimisation activity on the dashboard timeline.</div>
            </div>
            <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500">
              {dashboardLogs.length} entries
            </div>
          </div>

          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {visibleDashboardLogs.length ? visibleDashboardLogs.map((log, index) => (
              <div
                key={`${log.recorded_at ?? ''}-${log.action}-${log.service}-${index}`}
                className={cn('rounded-xl border p-3', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">{log.service}</div>
                  <div className={cn('rounded-full px-2.5 py-1 text-[9px] font-bold tracking-[0.2em] uppercase', log.status === 'success' ? 'bg-emerald-500/15 text-emerald-500' : log.status === 'failed' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                    {log.status}
                  </div>
                </div>
                <div className="mt-2 text-[16px] font-serif leading-none">{log.action.replace(/_/g, ' ')}</div>
                {log.recorded_at && (
                  <div className="mt-1 text-[10px] font-bold tracking-widest uppercase text-gray-500">{new Date(log.recorded_at).toLocaleString()}</div>
                )}
                <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{log.message}</p>
              </div>
            )) : (
              <div className="h-full rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-[15px] text-gray-500 flex items-center justify-center text-center">
                No recent optimisation logs are available for this window.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-h-0 overflow-visible xl:grid-cols-12">
        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015] xl:col-span-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">AWS COST MONITOR</h2>
              <button onClick={() => { setIsRefreshing(true); void loadDashboardData().finally(() => setIsRefreshing(false)); }} className="p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                <RefreshCw size={10} className={cn(isRefreshing && 'animate-spin')} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => setServicePageIndex((prev) => Math.max(0, prev - 1))} disabled={servicePageIndex === 0} className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"><ChevronLeft size={12} /></button>
                <span className="text-[12px] font-bold text-gray-500 tracking-widest w-14 text-center">{servicePageIndex + 1} / {totalPages}</span>
                <button onClick={() => setServicePageIndex((prev) => Math.min(totalPages - 1, prev + 1))} disabled={servicePageIndex === totalPages - 1} className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"><ChevronRight size={12} /></button>
              </div>
              <DashboardFilterDropdown theme={theme} filters={monitorFilters} onFilterChange={setMonitorFilters} align="up" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 flex-grow items-center sm:grid-cols-2 xl:grid-cols-3">
            {currentServices.map((service) => (
              <div key={service.id} className="space-y-2">
                <span className="text-[13px] font-bold text-gray-600 tracking-widest uppercase">{service.name}</span>
                <MiniChart data={service.data} />
                <div className="space-y-0.5">
                  <div className="text-3xl font-serif">{formatCurrency(service.cost)}</div>
                  <div className="text-[12px] font-bold text-gray-600 tracking-widest">LATEST OBSERVED COST</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015] xl:col-span-6">
          <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Cost Report</h2>
            <DashboardFilterDropdown theme={theme} filters={reportFilters} onFilterChange={setReportFilters} align="up" />
          </div>
          <div className="flex-grow w-full mt-4">
            {reportData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <Bar dataKey="value" radius={[1, 1, 0, 0]}>
                    {reportData.map((entry, index) => (
                      <Cell key={`report-${index}`} fill={entry.alert ? '#f87171' : theme === 'light' ? '#000000' : '#ffffff'} fillOpacity={entry.alert ? 1 : 0.08} />
                    ))}
                  </Bar>
                  <XAxis dataKey="day" axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} dy={5} interval={reportFilters.aggregate === 'DAILY' ? 3 : 0} />
                  <YAxis axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => active && payload && payload.length ? <div className="bg-zinc-900 border border-white/10 p-1.5 rounded text-[9px] font-bold text-white">{formatCurrency(Number(payload[0].value))}</div> : null} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-[15px] font-semibold text-gray-500 px-6">
                No report points are available for this range yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ForecastFilterDropdown({
  theme,
  filters,
  availableServices,
  onFilterChange,
}: {
  theme: Theme;
  filters: ForecastFilters;
  availableServices: string[];
  onFilterChange: (value: ForecastFilters) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleService = (service: string) => {
    const next = filters.services.includes(service)
      ? filters.services.filter((entry) => entry !== service)
      : [...filters.services, service];
    onFilterChange({ ...filters, services: next });
  };

  return (
    <div className="relative z-30">
      <button onClick={() => setIsOpen((value) => !value)} className="flex items-center gap-2 text-[12px] font-bold tracking-[0.25em] text-gray-500 border border-black/10 dark:border-gray-800 rounded-full px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        FILTERS
      </button>
      {isOpen && (
        <div className={cn('absolute right-0 top-full mt-3 w-64 rounded-xl shadow-2xl border border-black/15 dark:border-white/15 p-4 z-[200] backdrop-blur-sm', theme === 'light' ? 'bg-[#fffdf8] text-black' : 'bg-[#18181b] text-white')}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-1.5">Time Frame</label>
              <select value={filters.timeFrame} onChange={(event) => onFilterChange({ ...filters, timeFrame: event.target.value as TimeFrame })} style={selectSurfaceStyle(theme)} className="w-full text-[14px] font-bold border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none">
                {TIME_FRAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block">Services</label>
                <button onClick={() => onFilterChange({ ...filters, services: [] })} className="text-[10px] font-bold tracking-widest text-gray-500">ALL</button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {availableServices.map((service) => (
                  <label key={service} className="flex items-center gap-2.5 text-[12px] font-bold">
                    <input type="checkbox" checked={filters.services.includes(service)} onChange={() => toggleService(service)} className="w-3.5 h-3.5 rounded border-gray-300" />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForecastView({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicePageIndex, setServicePageIndex] = useState(0);
  const [filters, setFilters] = useState<ForecastFilters>({ timeFrame: 'past_one_month', services: [] });
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  const loadForecast = async (nextFilters: ForecastFilters = filters, nextDataMode: DataMode = dataMode) => {
    const response = await apiGet<ForecastResponse>(`/forecast/aws?${toForecastQuery(nextFilters, 7, nextDataMode)}`);
    setForecast(response);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadForecast();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load forecast data.');
      }
    };
    void run();
  }, [dataMode]);

  useEffect(() => {
    if (!forecast?.available_services.length) return;
    setFilters((current) => {
      const validServices = current.services.filter((service) => forecast.available_services.includes(service));
      return validServices.length === current.services.length ? current : { ...current, services: validServices };
    });
  }, [forecast?.available_services]);

  const serviceSummaries = useMemo(() => (forecast?.services || []).map(buildServiceSummary).sort((a, b) => b.historyTotal - a.historyTotal), [forecast]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(serviceSummaries.length / 3) - 1);
    setServicePageIndex((current) => Math.min(current, maxPage));
  }, [serviceSummaries.length]);

  const currentServices = serviceSummaries.slice(servicePageIndex * 3, (servicePageIndex + 1) * 3);
  const totalPages = Math.max(1, Math.ceil(serviceSummaries.length / 3));
  const totalSpend = serviceSummaries.reduce((sum, service) => sum + service.historyTotal, 0);
  const totalProjected = serviceSummaries.reduce((sum, service) => sum + service.projectedTotal, 0);

  const combinedSeries = useMemo(() => {
    const grouped = new Map<string, { actual: number; projected: number }>();
    for (const service of forecast?.services || []) {
      for (const point of service.history) {
        const row = grouped.get(point.ds) || { actual: 0, projected: 0 };
        row.actual += point.y;
        grouped.set(point.ds, row);
      }
      for (const point of service.forecast.slice(service.history.length)) {
        const row = grouped.get(point.ds) || { actual: 0, projected: 0 };
        row.projected += point.yhat;
        grouped.set(point.ds, row);
      }
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, values]) => ({ label: shortDate.format(new Date(date)), actual: values.actual, projected: values.projected || null }));
  }, [forecast]);

  const handleFilterChange = async (nextFilters: ForecastFilters) => {
    setFilters(nextFilters);
    try {
      setError(null);
      await loadForecast(nextFilters, dataMode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to reload forecast data.');
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      await loadForecast(filters, dataMode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh forecast data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-full min-h-0 grid grid-rows-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-3 overflow-visible">
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-400" /><span>{error}</span></div>}

      <div className="grid grid-cols-12 gap-3 min-h-0 overflow-visible">
        <div className={cn('col-span-3 rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between overflow-hidden transition-transform duration-200 hover:scale-[1.015]', theme === 'light' ? 'bg-[#e5e5e5]' : 'bg-[#2a2422]')}>
          <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">TOTAL SPEND</h2>
          <div className="space-y-0.5">
            <div className="text-6xl font-serif">{formatCurrency(totalSpend)}</div>
            <div className="text-[14px] font-bold text-gray-500 tracking-widest uppercase">{forecast ? `${forecast.history_start_date} to ${forecast.history_end_date}` : 'Loading history'}</div>
          </div>
          <div className="space-y-1.5 mt-4">
            <div className="text-[12px] font-bold text-gray-600 tracking-widest uppercase">Projected Next 7 Days</div>
            <div className="text-3xl font-serif text-[var(--color-accent-coral)]">{formatCurrency(totalProjected)}</div>
          </div>
        </div>

        <div className="col-span-9 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015]">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">AWS Service Forecast</h2>
              <div className="text-[12px] font-bold tracking-widest text-gray-500 uppercase mt-1">Dynamic service list from AWS history</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} className="p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"><RefreshCw size={10} className={cn(isRefreshing && 'animate-spin')} /></button>
              <ForecastFilterDropdown theme={theme} filters={filters} availableServices={forecast?.available_services || []} onFilterChange={handleFilterChange} />
            </div>
          </div>
          <div className="flex-grow w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceSummaries.slice(0, 8)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="service" axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                <YAxis axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                <Tooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: '#fff' }} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '7px', fontWeight: 700, paddingBottom: '5px' }} />
                <Bar dataKey="historyTotal" name="HISTORY" fill="#f87171" barSize={20} />
                <Bar dataKey="projectedTotal" name="FORECAST" fill={theme === 'light' ? '#000000' : '#ffffff'} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 min-h-0 overflow-visible">
        <div className="col-span-6 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">AWS COST MONITOR</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setServicePageIndex((prev) => Math.max(0, prev - 1))} disabled={servicePageIndex === 0} className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"><ChevronLeft size={12} /></button>
              <span className="text-[12px] font-bold text-gray-500 tracking-widest w-14 text-center">{Math.min(servicePageIndex + 1, totalPages)} / {totalPages}</span>
              <button onClick={() => setServicePageIndex((prev) => Math.min(totalPages - 1, prev + 1))} disabled={servicePageIndex === totalPages - 1} className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"><ChevronRight size={12} /></button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 flex-grow items-center">
            {currentServices.length ? currentServices.map((service) => (
              <div key={service.service} className="space-y-2">
                <span className="text-[13px] font-bold text-gray-600 tracking-widest uppercase">{service.service}</span>
                <MiniChart data={service.miniSeries} />
                <div className="space-y-0.5">
                  <div className="text-3xl font-serif">{formatCurrency(service.latestHistory)}</div>
                  <div className="text-[12px] font-bold text-gray-600 tracking-widest">{service.trend >= 0 ? '+' : ''}{service.trend.toFixed(1)}% VS FIRST POINT</div>
                </div>
              </div>
            )) : <div className="col-span-3 text-sm text-gray-500">No AWS services returned for these filters.</div>}
          </div>
        </div>

        <div className="col-span-6 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative overflow-visible transition-transform duration-200 hover:scale-[1.015]">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Cost Forecast Report</h2>
            <div className="text-[12px] font-bold tracking-widest text-gray-500 uppercase">Combined actual + projected totals</div>
          </div>
          <div className="flex-grow w-full mt-4">
            {combinedSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedSeries}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                  <YAxis axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                  <Tooltip content={({ active, payload, label }) => active && payload && payload.length ? <div className="bg-zinc-900 border border-white/10 p-2 rounded text-[9px] font-bold text-white"><div>{label}</div>{payload.map((entry) => <div key={String(entry.dataKey)}>{entry.name}: {formatCurrency(Number(entry.value))}</div>)}</div> : null} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '7px', fontWeight: 700, paddingBottom: '5px' }} />
                  <Line type="monotone" dataKey="actual" name="ACTUAL" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="projected" name="FORECAST" stroke={theme === 'light' ? '#000000' : '#ffffff'} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-[15px] font-semibold text-gray-500 px-6">
                No forecast points are available for this range yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatorView({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('past_one_month');
  const [service, setService] = useState<string>('');
  const [action, setAction] = useState<SimulatorAction>('resize_instance');
  const [customReduction, setCustomReduction] = useState<string>('');
  const [simulation, setSimulation] = useState<SimulatorResponse | null>(null);

  const actionLabels: Record<SimulatorAction, string> = {
    resize_instance: 'Resize instance',
    delete_volume: 'Delete volume',
    schedule_off_hours: 'Schedule off-hours',
    purchase_savings_plan: 'Savings plan',
  };

  const loadSimulation = async (overrides?: {
    timeFrame?: TimeFrame;
    service?: string;
    action?: SimulatorAction;
    reduction?: string;
  }) => {
    const nextTimeFrame = overrides?.timeFrame ?? timeFrame;
    const nextService = overrides?.service ?? service;
    const nextAction = overrides?.action ?? action;
    const nextReduction = overrides?.reduction ?? customReduction;

    const params = new URLSearchParams();
    params.set('time_frame', nextTimeFrame);
    params.set('action', nextAction);
    if (nextService) params.set('service', nextService);
    if (nextReduction.trim()) params.set('reduction_percent', nextReduction.trim());
    appendDataMode(params, dataMode);

    const response = await apiGet<SimulatorResponse>(`/what-if/simulate?${params.toString()}`);
    setSimulation(response);
    if (!nextService || !response.available_services.includes(nextService)) {
      setService(response.service);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadSimulation();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load simulation.');
      }
    };
    void run();
  }, [dataMode]);

  const historySeries = useMemo(
    () =>
      (simulation?.history || []).map((point) => ({
        label: shortDate.format(new Date(point.date)),
        amount: point.amount,
      })),
    [simulation],
  );

  const handleApply = async (overrides?: {
    timeFrame?: TimeFrame;
    service?: string;
    action?: SimulatorAction;
    reduction?: string;
  }) => {
    try {
      setError(null);
      setIsRefreshing(true);
      await loadSimulation(overrides);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to run simulation.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-400" /><span>{error}</span></div>}

      <div className="grid grid-cols-1 gap-3 flex-[1.1] min-h-0 xl:grid-cols-12">
        <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col gap-4 transition-transform duration-200 hover:scale-[1.015] xl:col-span-4">
          <div>
            <h2 className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">What-If Simulator</h2>
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
              Test a cost action against recent history and estimate projected monthly savings.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase block mb-1">Time frame</label>
              <select
                value={timeFrame}
                onChange={(event) => {
                  const value = event.target.value as TimeFrame;
                  setTimeFrame(value);
                  void handleApply({ timeFrame: value });
                }}
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-base font-bold outline-none"
              >
                {TIME_FRAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase block mb-1">Service</label>
              <select
                value={service}
                onChange={(event) => {
                  const value = event.target.value;
                  setService(value);
                  void handleApply({ service: value });
                }}
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-base font-bold outline-none"
              >
                {(simulation?.available_services || []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase block mb-1">Action</label>
              <select
                value={action}
                onChange={(event) => {
                  const value = event.target.value as SimulatorAction;
                  setAction(value);
                  void handleApply({ action: value });
                }}
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-base font-bold outline-none"
              >
                {Object.entries(actionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase block mb-1">Custom reduction %</label>
              <input
                value={customReduction}
                onChange={(event) => setCustomReduction(event.target.value)}
                onBlur={() => void handleApply({ reduction: customReduction })}
                placeholder="Leave blank for default"
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-base font-bold outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => void handleApply()}
            className={cn(
              'mt-auto rounded-full px-4 py-2 text-sm font-bold tracking-widest transition-colors',
              theme === 'light' ? 'bg-black text-white hover:bg-black/80' : 'bg-white text-black hover:bg-white/80',
            )}
          >
            {isRefreshing ? 'RUNNING...' : 'RUN SIMULATION'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-8 xl:grid-cols-3">
          <div className={cn('rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]', theme === 'light' ? 'bg-[#e5e5e5]' : 'bg-[#2a2422]')}>
            <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Projected Monthly Cost</div>
            <div className="text-4xl font-serif">{money.format(simulation?.projected_monthly_cost || 0)}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">{simulation?.service || 'Loading service'}</div>
          </div>
          <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]">
            <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Estimated Saving</div>
            <div className="text-4xl font-serif text-[var(--color-accent-coral)]">{money.format(simulation?.estimated_monthly_saving || 0)}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {simulation ? `${simulation.applied_reduction_percent}% reduction` : 'Calculating'}
            </div>
          </div>
          <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]">
            <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Optimized Monthly Cost</div>
            <div className="text-4xl font-serif">{money.format(simulation?.optimized_monthly_cost || 0)}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {simulation ? `${simulation.history_days} history days` : 'Loading'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 flex-1 min-h-0 xl:grid-cols-12">
        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col transition-transform duration-200 hover:scale-[1.015] xl:col-span-8">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">Historical Trend Used In Simulation</h2>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {simulation ? `${simulation.history_start_date} to ${simulation.history_end_date}` : ''}
            </div>
          </div>
          <div className="flex-grow w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historySeries}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                <YAxis axisLine={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} tickLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--chart-label)' }} />
                <Tooltip formatter={(value: number) => money.format(value)} />
                <Line type="monotone" dataKey="amount" name="Historical cost" stroke="#f87171" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col gap-4 transition-transform duration-200 hover:scale-[1.015] xl:col-span-4">
          <div>
            <h2 className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">Scenario Summary</h2>
            <div className="mt-3 text-lg font-serif">{simulation?.service || 'Loading'}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-1">
              {simulation ? actionLabels[simulation.action] : 'Scenario'}
            </div>
          </div>

          <div className="rounded-xl border border-black/5 dark:border-white/10 p-4 bg-black/5 dark:bg-white/5">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">Model Note</div>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
              {simulation?.explanation || 'Loading simulation details.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/5 dark:border-white/10 p-3">
              <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Trend ratio</div>
              <div className="mt-2 text-2xl font-serif">{((simulation?.trend_ratio || 0) * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-black/5 dark:border-white/10 p-3">
              <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Data source</div>
              <div className="mt-2 text-lg font-serif">{simulation?.data_source === 'synthetic_fallback' ? 'Fallback' : 'AWS'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitorView({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('past_one_month');
  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chaosModeEnabled, setChaosModeEnabled] = useState(false);
  const [chaosBusy, setChaosBusy] = useState(false);

  const startChaosMode = async () => {
    setChaosBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/chaos/start`, { method: 'POST' });
      if (response.status === 403) {
        setError('Chaos mode is disabled on the API. Set ENABLE_CHAOS_MODE=true.');
        return;
      }
      if (!response.ok) {
        throw new Error(`Chaos start failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { status?: string; message?: string };
      if (payload.status === 'started' || payload.status === 'already_running') {
        setChaosModeEnabled(true);
      }
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start chaos mode.');
    } finally {
      setChaosBusy(false);
    }
  };

  const stopChaosMode = async () => {
    setChaosBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/chaos/stop`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Chaos stop failed with status ${response.status}`);
      }
      setChaosModeEnabled(false);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Unable to stop chaos mode.');
    } finally {
      setChaosBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async (isInitial: boolean) => {
      try {
        if (isInitial) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
        setError(null);
        const params = new URLSearchParams();
        params.set('time_frame', timeFrame);
        appendDataMode(params, dataMode);
        const result = await apiGetMonitor(params.toString());
        if (!cancelled) {
          setMonitor(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load service monitor.');
        }
      } finally {
        if (!cancelled) {
          if (isInitial) {
            setIsLoading(false);
          }
          setIsRefreshing(false);
        }
      }
    };

    void load(true);
    const intervalId = window.setInterval(() => {
      void load(false);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [timeFrame, dataMode]);

  const services = monitor?.active_services || [];
  const logs = monitor?.automation_logs || [];
  const reasoning = monitor?.optimization_reasoning || [];

  return (
    <div className="h-full min-h-0 grid grid-cols-1 gap-3 overflow-hidden lg:grid-rows-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="min-h-0 rounded-xl border border-black/5 dark:border-white/5 bg-[var(--color-card-bg)] p-5 flex flex-col transition-transform duration-200 hover:scale-[1.01]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">All active services</h2>
            <div className="mt-2 text-[15px] text-gray-500">
              {monitor ? `${monitor.service_count} services in this window (${monitor.history_start_date} to ${monitor.history_end_date})` : 'Loading service inventory'}
              {isRefreshing && !isLoading && (
                <span className="ml-2 text-[11px] font-bold tracking-widest uppercase text-emerald-500"> · updating</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeFrame}
              onChange={(event) => setTimeFrame(event.target.value as TimeFrame)}
              style={selectSurfaceStyle(theme)}
              className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2 text-[14px] font-bold outline-none"
            >
              {TIME_FRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={cn('mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', theme === 'light' ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.03]')}>
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Chaos mode (demo)</div>
          <button
            type="button"
            disabled={chaosBusy}
            onClick={() => void startChaosMode()}
            className={cn(
              'rounded-full px-4 py-2 text-[12px] font-bold tracking-widest uppercase transition-colors disabled:opacity-40',
              theme === 'light' ? 'bg-black text-white hover:bg-black/85' : 'bg-white text-black hover:bg-white/85',
            )}
          >
            {chaosBusy ? 'Working…' : 'Enable Chaos Mode'}
          </button>
          <button
            type="button"
            disabled={chaosBusy}
            onClick={() => void stopChaosMode()}
            className={cn(
              'rounded-full border px-4 py-2 text-[12px] font-bold tracking-widest uppercase transition-colors disabled:opacity-40',
              theme === 'light' ? 'border-black/20 hover:bg-black/5' : 'border-white/20 hover:bg-white/5',
            )}
          >
            Stop Chaos Mode
          </button>
          {chaosModeEnabled && (
            <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">Chaos workflow armed or running</span>
          )}
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-400" /><span>{error}</span></div>}

        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(isLoading ? Array.from({ length: 6 }) : services).map((service, index) => (
              <div
                key={isLoading ? `service-skeleton-${index}` : service.service}
                className={cn('rounded-xl border p-4 min-h-[10rem] transition-transform duration-200 hover:scale-[1.02]', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}
              >
                {isLoading ? (
                  <div className="h-full animate-pulse space-y-4">
                    <div className="h-4 w-24 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-10 w-32 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-3 w-20 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-3 w-28 rounded bg-black/10 dark:bg-white/10" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{service.service}</div>
                      <div className={cn('rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase', service.status === 'active' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-gray-500/15 text-gray-400')}>
                        {service.status}
                      </div>
                    </div>
                    <div className="mt-4 text-4xl font-serif">{money.format(service.total_cost || 0)}</div>
                    <div className="mt-3 text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">{service.record_count} grouped records</div>
                    <div className="mt-2 text-[14px] text-gray-500">Last seen {service.last_seen}</div>
                  </>
                )}
              </div>
            ))}
          </div>
          {!isLoading && !services.length && (
            <div className="mt-6 rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-[15px] text-gray-500">
              No active services were found for this window.
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="min-h-0 rounded-xl border border-black/5 dark:border-white/5 bg-[var(--color-card-bg)] p-5 flex flex-col transition-transform duration-200 hover:scale-[1.01]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Automation optimisation logs</h2>
              <div className="mt-2 text-[14px] text-gray-500">Stream of actions from the cost optimisation automation.</div>
            </div>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{isLoading ? '…' : `${logs.length} entries`}</div>
          </div>
          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`log-skeleton-${index}`} className={cn('rounded-xl border p-4 animate-pulse', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}>
                    <div className="h-3 w-20 rounded bg-black/10 dark:bg-white/10" />
                    <div className="mt-3 h-5 w-48 rounded bg-black/10 dark:bg-white/10" />
                    <div className="mt-2 h-12 w-full rounded bg-black/10 dark:bg-white/10" />
                  </div>
                ))}
              </div>
            ) : logs.length ? logs.map((log, index) => (
              <div key={`${log.recorded_at ?? ''}-${log.action}-${log.service}-${index}`} className={cn('rounded-xl border p-4', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-gray-500">{log.service}</div>
                  <div className={cn('rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase', log.status === 'success' ? 'bg-emerald-500/15 text-emerald-500' : log.status === 'failed' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                    {log.status}
                  </div>
                </div>
                <div className="mt-2 text-[18px] font-serif">{log.action.replace(/_/g, ' ')}</div>
                {log.recorded_at && (
                  <div className="mt-1 text-[11px] font-bold tracking-widest uppercase text-gray-500">{new Date(log.recorded_at).toLocaleString()}</div>
                )}
                <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{log.message}</p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-[15px] text-gray-500">
                No automation actions have been logged yet.
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 rounded-xl border border-black/5 dark:border-white/5 bg-[var(--color-card-bg)] p-5 flex flex-col transition-transform duration-200 hover:scale-[1.01]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Optimization reasoning</h2>
              <div className="mt-2 text-[14px] text-gray-500">Why the optimiser chose actions, stayed idle, or prioritised certain services.</div>
            </div>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{isLoading ? '…' : `${reasoning.length} notes`}</div>
          </div>
          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`reason-skeleton-${index}`} className={cn('rounded-xl border p-4 animate-pulse', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}>
                    <div className="h-5 w-3/4 max-w-xs rounded bg-black/10 dark:bg-white/10" />
                    <div className="mt-3 h-16 w-full rounded bg-black/10 dark:bg-white/10" />
                  </div>
                ))}
              </div>
            ) : reasoning.length ? reasoning.map((item, index) => (
              <div key={`${item.kind}-${index}`} className={cn('rounded-xl border p-4', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[18px] font-serif">{item.title}</div>
                  <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-500">{item.kind}</div>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-500">{item.detail}</p>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-[15px] text-gray-500">
                No reasoning is available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantView({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [question, setQuestion] = useState('Which services are driving my AI cloud spend this month, and where should I look first for savings?');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('past_one_month');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);

  const askAssistant = async (overrides?: { question?: string; timeFrame?: TimeFrame; service?: string }) => {
    const nextQuestion = overrides?.question ?? question;
    const nextTimeFrame = overrides?.timeFrame ?? timeFrame;
    const nextService = overrides?.service ?? serviceFilter;

    const payload = {
      question: nextQuestion,
      time_frame: nextTimeFrame,
      services: nextService ? [nextService] : [],
      force_fallback: dataMode === 'fallback',
    };

    const result = await fetch(`${API_BASE_URL}/assistant/finops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      throw new Error(`Assistant request failed with status ${result.status}`);
    }

    const parsed = (await result.json()) as AssistantResponse;
    setResponse(parsed);
    if (nextService && !parsed.available_services.includes(nextService)) {
      setServiceFilter('');
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setIsLoading(true);
        await askAssistant();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the assistant.');
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [dataMode]);

  const topServices = response?.summary.top_services || [];

  return (
    <div className="h-full min-h-0 grid grid-cols-1 gap-3 overflow-hidden xl:grid-cols-12">
      <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col gap-4 transition-transform duration-200 hover:scale-[1.015] xl:col-span-4">
        <div>
          <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Ask FinOps</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
            Ask about AI spend, top services, savings opportunities, and usage patterns.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase block mb-1.5">Question</label>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className={cn('min-h-36 w-full rounded-xl border px-4 py-3 text-[16px] font-semibold outline-none resize-none', theme === 'light' ? 'border-black/10 bg-[#fffdf8] text-black' : 'border-white/10 bg-[#18181b] text-white')}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase block mb-1.5">Time frame</label>
              <select
                value={timeFrame}
                onChange={(event) => setTimeFrame(event.target.value as TimeFrame)}
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-[15px] font-bold outline-none"
              >
                {TIME_FRAME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase block mb-1.5">Service</label>
              <select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                style={selectSurfaceStyle(theme)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-[15px] font-bold outline-none"
              >
                <option value="">All services</option>
                {(response?.available_services || []).map((service) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            void (async () => {
              try {
                setError(null);
                setIsLoading(true);
                await askAssistant();
              } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : 'Unable to query the assistant.');
              } finally {
                setIsLoading(false);
              }
            })();
          }}
          className={cn('mt-auto rounded-full px-4 py-3 text-[13px] font-bold tracking-[0.25em] transition-colors flex items-center justify-center gap-2', theme === 'light' ? 'bg-black text-white hover:bg-black/80' : 'bg-white text-black hover:bg-white/80')}
        >
          <Send size={14} />
          {isLoading ? 'ASKING...' : 'ASK ASSISTANT'}
        </button>
      </div>

      <div className="min-h-0 grid grid-cols-1 gap-3 xl:col-span-8 xl:grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col transition-transform duration-200 hover:scale-[1.015] min-h-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Assistant Response</h2>
              <div className="mt-1 text-[12px] font-bold tracking-widest uppercase text-gray-500">
                {response?.provider === 'groq' ? `Groq • ${response.model}` : 'Local summary fallback'}
              </div>
            </div>
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-400" /><span>{error}</span></div>}
          <div className={cn('mt-4 flex-1 rounded-xl border p-4 overflow-y-auto', theme === 'light' ? 'border-black/10 bg-[#fffdf8]' : 'border-white/10 bg-white/5')}>
            <div className="text-[18px] leading-relaxed whitespace-pre-wrap">
              {response?.answer || 'Loading assistant context...'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-h-0 sm:grid-cols-2 xl:grid-cols-3">
          <div className={cn('rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]', theme === 'light' ? 'bg-[#e5e5e5]' : 'bg-[#2a2422]')}>
            <div className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">Observed Cost</div>
            <div className="text-4xl font-serif">{money.format(response?.summary.total_cost || 0)}</div>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{response ? `${response.history_start_date} to ${response.history_end_date}` : 'Loading range'}</div>
          </div>
          <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]">
            <div className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">Average Daily</div>
            <div className="text-4xl font-serif">{money.format(response?.summary.average_daily_cost || 0)}</div>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{response?.summary.total_records || 0} grouped records</div>
          </div>
          <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between transition-transform duration-200 hover:scale-[1.015]">
            <div className="text-[11px] font-bold tracking-[0.2em] text-gray-400 uppercase">Peak Day</div>
            <div className="text-4xl font-serif">{money.format(response?.summary.peak_day_cost || 0)}</div>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{response?.summary.peak_day || 'No day available'}</div>
          </div>
        </div>

        <div className="bg-[var(--color-card-bg)] rounded-xl p-5 border border-black/5 dark:border-white/5 transition-transform duration-200 hover:scale-[1.015]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Top Services In Context</h2>
            <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{serviceFilter || 'All services'}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {topServices.length ? topServices.slice(0, 3).map((item) => (
              <div key={item.service} className="rounded-xl border border-black/5 dark:border-white/10 p-4 bg-black/5 dark:bg-white/5">
                <div className="text-[12px] font-bold tracking-widest uppercase text-gray-500">{item.service}</div>
                <div className="mt-2 text-3xl font-serif">{money.format(item.total_cost)}</div>
                <div className="mt-1 text-[12px] font-bold tracking-widest uppercase text-gray-500">{(item.share * 100).toFixed(1)}% of total</div>
              </div>
            )) : (
              <div className="text-[15px] text-gray-500 sm:col-span-2 xl:col-span-3">No service summary available yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingAssistant({ theme, dataMode }: { theme: Theme; dataMode: DataMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('past_one_month');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask me anything about cloud usage, cost trends, service drivers, or savings opportunities.',
    },
  ]);
  const [lastResponse, setLastResponse] = useState<AssistantResponse | null>(null);

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/assistant/finops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          time_frame: timeFrame,
          services: [],
          force_fallback: dataMode === 'fallback',
        }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed with status ${response.status}`);
      }

      const parsed = (await response.json()) as AssistantResponse;
      setLastResponse(parsed);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: parsed.answer,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Unable to reach the assistant right now.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-3 bottom-3 z-[400] flex flex-col items-end gap-3 sm:right-5 sm:bottom-5">
      {isOpen && (
        <div className={cn('w-[calc(100vw-1.5rem)] max-w-[24rem] h-[min(70vh,32rem)] rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 backdrop-blur-sm sm:w-[24rem]', theme === 'light' ? 'border-black/10 bg-[#fffdf8]/95 text-black' : 'border-white/10 bg-[#111111]/95 text-white')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold tracking-[0.3em] uppercase text-gray-500">CloudGuard</div>
              <div className="mt-1 text-2xl font-serif">Quick Chat</div>
              <div className="mt-1 text-[12px] font-bold tracking-widest uppercase text-gray-500">
                {lastResponse?.provider === 'groq' ? `Groq • ${lastResponse.model}` : 'Ready to help'}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Time Frame</label>
            <select
              value={timeFrame}
              onChange={(event) => setTimeFrame(event.target.value as TimeFrame)}
              style={selectSurfaceStyle(theme)}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-[13px] font-bold outline-none"
            >
              {TIME_FRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>


          <div className={cn('flex-1 rounded-2xl border p-3 overflow-y-auto space-y-3', theme === 'light' ? 'border-black/10 bg-[#f7f3ea]' : 'border-white/10 bg-white/5')}>
            {messages.map((message) => (
              <div key={message.id} className={cn('max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed', message.role === 'user' ? theme === 'light' ? 'ml-auto bg-black text-white' : 'ml-auto bg-white text-black' : theme === 'light' ? 'bg-white border border-black/10' : 'bg-[#191919] border border-white/10')}>
                {message.content}
              </div>
            ))}
            {isLoading && (
              <div className={cn('max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed', theme === 'light' ? 'bg-white border border-black/10' : 'bg-[#191919] border border-white/10')}>
                Thinking...
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion();
                }
              }}
              placeholder="Ask about spend, trends, anomalies, or savings..."
              className={cn('flex-1 min-h-20 max-h-28 rounded-2xl border px-4 py-3 text-[15px] font-semibold outline-none resize-none', theme === 'light' ? 'border-black/10 bg-[#fffdf8] text-black' : 'border-white/10 bg-[#18181b] text-white')}
            />
            <button
              onClick={() => void submitQuestion()}
              className={cn('rounded-full p-3 transition-colors shrink-0', theme === 'light' ? 'bg-black text-white hover:bg-black/80' : 'bg-white text-black hover:bg-white/80')}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((current) => !current)}
        className={cn('rounded-full shadow-xl border p-4 flex items-center justify-center transition-transform duration-200 hover:scale-[1.04]', theme === 'light' ? 'border-black/10 bg-black text-white' : 'border-white/10 bg-white text-black')}
        aria-label="Open CloudGuard assistant"
        title="CloudGuard"
      >
        <Bot size={22} />
      </button>
    </div>
  );
}

export default function App({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [view, setView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>('aws');

  return (
    <div className={cn('min-h-screen w-full p-2 font-sans overflow-x-hidden transition-colors duration-300 sm:p-3', theme === 'light' ? 'light' : 'dark')}>
      <div className="mx-auto min-h-[calc(100vh-1rem)] w-full max-w-[1500px] sm:min-h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-1.5rem)] lg:max-h-[1080px]">
        <div className="flex min-h-full flex-col gap-3 lg:h-full lg:flex-row">
          <Sidebar theme={theme} view={view} setView={setView} collapsed={sidebarCollapsed} toggleCollapsed={() => setSidebarCollapsed((value) => !value)} dataMode={dataMode} toggleDataMode={() => setDataMode((current) => (current === 'aws' ? 'fallback' : 'aws'))} />
          <main className={cn('flex-1 min-w-0 rounded-2xl border p-3 flex flex-col gap-3 shadow-sm overflow-visible sm:p-4', theme === 'light' ? 'border-black/10 bg-[#f7f3ea]' : 'border-white/5 bg-transparent')}>
          <TopBar theme={theme} view={view} toggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))} onOpenProfile={onOpenProfile} />
          <div className={cn('flex-1 min-h-0 pr-0 sm:pr-1', view === 'simulator' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-visible lg:overflow-hidden')}>
            {view === 'dashboard' ? <DashboardView theme={theme} dataMode={dataMode} /> : view === 'monitor' ? <MonitorView theme={theme} dataMode={dataMode} /> : view === 'forecast' ? <ForecastView theme={theme} dataMode={dataMode} /> : view === 'simulator' ? <SimulatorView theme={theme} dataMode={dataMode} /> : <AssistantView theme={theme} dataMode={dataMode} />}
          </div>
          </main>
        </div>
        <FloatingAssistant theme={theme} dataMode={dataMode} />
      </div>
    </div>
  );
}
