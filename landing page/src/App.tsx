/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import LandingPage from './components/LandingPage';
import { 
  User, 
  RefreshCw, 
  TrendingDown, 
  ChevronDown,
  ArrowRight,
  Sun,
  Moon,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  ResponsiveContainer, 
  XAxis, 
  YAxis,
  Tooltip, 
  Cell,
  Legend
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock data for charts
const generateData = (aggregate: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'WEEKLY') => {
  const length = aggregate === 'DAILY' ? 24 : aggregate === 'WEEKLY' ? 7 : 4;
  return Array.from({ length }, (_, i) => ({ 
    value: 20 + Math.random() * 60,
    isAnomaly: Math.random() > 0.9
  }));
};

const ALL_SERVICES = [
  { id: 'ec2', name: 'EC2 Compute', cost: 1842, data: generateData() },
  { id: 's3', name: 'S3 Storage', cost: 412, data: generateData() },
  { id: 'rds', name: 'RDS Database', cost: 926, data: generateData() },
  { id: 'lambda', name: 'Lambda', cost: 156, data: generateData() },
  { id: 'dynamodb', name: 'DynamoDB', cost: 284, data: generateData() },
  { id: 'cloudfront', name: 'CloudFront', cost: 198, data: generateData() },
  { id: 'route53', name: 'Route 53', cost: 45, data: generateData() },
  { id: 'elasticache', name: 'ElastiCache', cost: 312, data: generateData() },
  { id: 'vpc', name: 'VPC Networking', cost: 88, data: generateData() },
];

const optimizationData = [
  { name: 'EC2', optimized: 890, savings: 350 },
  { name: 'S3', optimized: 410, savings: 110 },
  { name: 'RDS', optimized: 720, savings: 260 },
  { name: 'Lambda', optimized: 150, savings: 60 },
  { name: 'DynamoDB', optimized: 280, savings: 60 },
];

const dailyReportData = [
  { day: 'MON', value: 45 },
  { day: 'TUE', value: 52 },
  { day: 'WED', value: 85, alert: true },
  { day: 'THU', value: 48 },
  { day: 'FRI', value: 55 },
  { day: 'SAT', value: 42 },
  { day: 'SUN', value: 38 },
];

const hourlyReportData = Array.from({ length: 24 }, (_, i) => ({
  day: `${i}:00`,
  value: 20 + Math.random() * 40,
  alert: i === 14
}));

const monthlyReportData = [
  { day: 'WK 1', value: 240 },
  { day: 'WK 2', value: 310 },
  { day: 'WK 3', value: 280 },
  { day: 'WK 4', value: 350, alert: true },
];

const timelineData = [
  { date: 'MAR 20', score: -0.1 },
  { date: 'MAR 21', score: -0.2 },
  { date: 'MAR 22', score: -0.15 },
  { date: 'MAR 23', score: -0.3 },
  { date: 'MAR 24', score: -0.82, active: true },
  { date: 'MAR 25', score: -0.25 },
  { date: 'MAR 26', score: -0.18 },
];

const CubeGraphic = () => (
  <svg viewBox="0 0 100 100" className="w-24 h-24 opacity-30">
    <path d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M50 10 L50 90" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M10 30 L50 50 L90 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M10 70 L50 50 L90 70" fill="none" stroke="currentColor" strokeWidth="0.5" />
    {/* Anomaly dots inside cube - No Greens */}
    <circle cx="40" cy="40" r="1.5" fill="var(--color-accent-neutral)" />
    <circle cx="65" cy="42" r="1.5" fill="var(--color-accent-neutral)" />
    <circle cx="55" cy="62" r="2" fill="#3c6e71" className="animate-pulse" />
  </svg>
);

const MiniChart = ({ data, color = "var(--color-accent-neutral)" }: { data: any[], color?: string }) => (
  <div className="h-14 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <Bar dataKey="value" radius={[1, 1, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.isAnomaly ? "#3c6e71" : color} fillOpacity={entry.isAnomaly ? 1 : 0.2} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

interface FilterState {
  aggregate: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  timeFrame: '7 DAYS' | '30 DAYS' | 'YTD';
  services: string[];
}

const FilterDropdown = ({ 
  theme, 
  align = "down", 
  filters, 
  onFilterChange 
}: { 
  theme: string; 
  align?: "up" | "down";
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleServiceToggle = (serviceId: string) => {
    const newServices = filters.services.includes(serviceId)
      ? filters.services.filter(id => id !== serviceId)
      : [...filters.services, serviceId];
    onFilterChange({ ...filters, services: newServices });
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[8px] font-bold tracking-widest text-gray-500 border border-black/10 dark:border-gray-800 rounded-full px-2.5 py-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <Filter size={10} />
        FILTER
      </button>
      
      {isOpen && (
        <div className={cn(
          "absolute right-0 w-40 rounded-lg shadow-2xl border border-black/20 dark:border-white/20 p-3 z-[100] origin-top-right animate-in fade-in zoom-in duration-200",
          align === "up" ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-1.5 origin-top-right",
          theme === 'light' ? "bg-white" : "bg-zinc-900"
        )}>
          <div className="space-y-3">
            <div>
              <label className="text-[6px] font-bold text-gray-500 tracking-widest uppercase block mb-1">1. Aggregate</label>
              <select 
                value={filters.aggregate}
                onChange={(e) => onFilterChange({ ...filters, aggregate: e.target.value as any })}
                className={cn(
                  "w-full bg-transparent text-[8px] font-bold border border-black/10 dark:border-white/10 rounded px-1.5 py-1 outline-none cursor-pointer",
                  theme === 'light' ? "text-black" : "text-white"
                )}
              >
                <option value="DAILY" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>DAILY</option>
                <option value="WEEKLY" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>WEEKLY</option>
                <option value="MONTHLY" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="text-[6px] font-bold text-gray-500 tracking-widest uppercase block mb-1">2. Time Frame</label>
              <select 
                value={filters.timeFrame}
                onChange={(e) => onFilterChange({ ...filters, timeFrame: e.target.value as any })}
                className={cn(
                  "w-full bg-transparent text-[8px] font-bold border border-black/10 dark:border-white/10 rounded px-1.5 py-1 outline-none cursor-pointer",
                  theme === 'light' ? "text-black" : "text-white"
                )}
              >
                <option value="7 DAYS" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>7 DAYS</option>
                <option value="30 DAYS" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>30 DAYS</option>
                <option value="YTD" className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>YTD</option>
              </select>
            </div>
            <div>
              <label className="text-[6px] font-bold text-gray-500 tracking-widest uppercase block mb-1">3. Service</label>
              <div className="space-y-1 max-h-20 overflow-y-auto pr-1 custom-scrollbar">
                {['ec2', 's3', 'rds', 'lambda', 'dynamodb'].map(id => (
                  <label key={id} className={cn(
                    "flex items-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-0.5 rounded",
                    theme === 'light' ? "text-black" : "text-white"
                  )}>
                    <input 
                      type="checkbox" 
                      checked={filters.services.includes(id)}
                      onChange={() => handleServiceToggle(id)}
                      className="w-2 h-2 rounded border-gray-300" 
                    />
                    <span className="text-[7px] font-bold uppercase">{id}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function Dashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [servicePageIndex, setServicePageIndex] = useState(0);

  // Filter States
  const [optimizationFilters, setOptimizationFilters] = useState<FilterState>({
    aggregate: 'WEEKLY',
    timeFrame: '30 DAYS',
    services: ['ec2', 's3', 'rds', 'lambda', 'dynamodb']
  });

  const [monitorFilters, setMonitorFilters] = useState<FilterState>({
    aggregate: 'DAILY',
    timeFrame: '30 DAYS',
    services: ['ec2', 's3', 'rds', 'lambda', 'dynamodb', 'cloudfront', 'route53', 'elasticache', 'vpc']
  });

  const [reportFilters, setReportFilters] = useState<FilterState>({
    aggregate: 'WEEKLY',
    timeFrame: '30 DAYS',
    services: ['ec2', 's3', 'rds', 'lambda', 'dynamodb']
  });

  // Derived Data
  const filteredOptimizationData = useMemo(() => {
    return optimizationData.filter(d => 
      optimizationFilters.services.includes(d.name.toLowerCase())
    ).map(d => {
      const timeMultiplier = optimizationFilters.timeFrame === '7 DAYS' ? 0.25 : optimizationFilters.timeFrame === 'YTD' ? 4 : 1;
      const aggMultiplier = optimizationFilters.aggregate === 'DAILY' ? 1/30 : optimizationFilters.aggregate === 'MONTHLY' ? 4 : 1;
      const totalMultiplier = timeMultiplier * aggMultiplier;
      return { 
        ...d, 
        optimized: Math.round(d.optimized * totalMultiplier), 
        savings: Math.round(d.savings * totalMultiplier) 
      };
    });
  }, [optimizationFilters]);

  const filteredMonitorServices = useMemo(() => {
    return ALL_SERVICES.filter(s => 
      monitorFilters.services.includes(s.id)
    ).map(s => {
      const timeMultiplier = monitorFilters.timeFrame === '7 DAYS' ? 0.25 : monitorFilters.timeFrame === 'YTD' ? 4 : 1;
      const aggMultiplier = monitorFilters.aggregate === 'DAILY' ? 1/30 : monitorFilters.aggregate === 'MONTHLY' ? 4 : 1;
      const totalMultiplier = timeMultiplier * aggMultiplier;
      return { 
        ...s, 
        cost: Math.round(s.cost * totalMultiplier),
        data: generateData(monitorFilters.aggregate)
      };
    });
  }, [monitorFilters]);

  const servicesPerPage = 3;
  const totalPages = Math.ceil(filteredMonitorServices.length / servicesPerPage);
  const currentServices = filteredMonitorServices.slice(servicePageIndex * servicesPerPage, (servicePageIndex + 1) * servicesPerPage);

  const getReportData = useMemo(() => {
    let baseData = reportFilters.aggregate === 'DAILY' ? hourlyReportData : reportFilters.aggregate === 'WEEKLY' ? dailyReportData : monthlyReportData;
    const multiplier = reportFilters.timeFrame === '7 DAYS' ? 0.5 : reportFilters.timeFrame === 'YTD' ? 3 : 1;
    return baseData.map(d => ({ ...d, value: Math.round(d.value * multiplier) }));
  }, [reportFilters]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className={cn(
      "h-screen w-full p-4 font-sans overflow-hidden flex flex-col gap-2 transition-colors duration-300",
      theme === 'light' ? 'light' : 'dark'
    )}>
      {/* Header */}
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToLanding}>
            <div className={cn("w-5 h-5 border-2 flex items-center justify-center", theme === 'light' ? "border-black" : "border-[#ff00ff] shadow-[0_0_10px_#ff00ff]")}>
              <div className={cn("w-1.5 h-1.5", theme === 'light' ? "bg-black" : "bg-[#ff00ff] shadow-[0_0_5px_#ff00ff]")} />
            </div>
            <span className={cn("text-lg font-bold tracking-tighter uppercase font-brand", theme === 'light' ? "text-black" : "text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]")}>CloudSense</span>
          </div>
          <nav className="flex items-center gap-4 text-[9px] font-bold tracking-widest text-gray-500">
            <a href="#" className={cn("pb-0.5", theme === 'light' ? "text-black border-b border-black" : "text-white border-b border-white")}>DASHBOARD</a>
            <a href="#" className="hover:text-gray-400 transition-colors">RESOURCES</a>
            <a href="#" className="hover:text-gray-400 transition-colors">REPORTS</a>
            <a href="#" className="hover:text-gray-400 transition-colors">SETTINGS</a>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-bold tracking-widest text-gray-500">
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={14} className="text-black" /> : <Sun size={14} className="text-white" />}
          </button>
          <span>ACCOUNT</span>
          <div className={cn("flex items-center gap-2", theme === 'light' ? "text-black" : "text-white")}>
            <span>PRIYA SHARMA</span>
            <div className="w-7 h-7 rounded-full bg-zinc-800/20 dark:bg-zinc-800 flex items-center justify-center">
              <User size={14} />
            </div>
          </div>
        </div>
      </header>

      {/* Overview Title Section */}
      <div className="grid grid-cols-3 items-baseline shrink-0">
        <h1 className="text-4xl font-serif font-light">Overview</h1>
        <div className="text-center text-3xl font-serif font-light opacity-40">14:32 UTC</div>
        <div className="text-right text-3xl font-serif font-light opacity-40">27 March 2026</div>
      </div>

      {/* Top Row Grid */}
      <div className="grid grid-cols-12 gap-3 flex-[1.2] min-h-0">
        {/* Total Spend */}
        <div className={cn(
          "col-span-3 rounded-xl p-5 border border-black/5 dark:border-white/5 flex flex-col justify-between overflow-hidden bg-[#284b63] text-white"
        )}>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400">TOTAL SPEND</h2>
          <div className="space-y-0.5">
            <div className="text-6xl font-serif">$247</div>
            <div className="text-[9px] font-bold text-gray-500 tracking-widest">USD THIS MONTH</div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60 tracking-widest mt-4">
            <TrendingDown size={12} />
            4.2% VS LAST MONTH
          </div>
        </div>

        {/* Optimization Impact (Stacked Bar Graph) */}
        <div className="col-span-9 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase">Optimization Impact</h2>
            <FilterDropdown 
              theme={theme} 
              filters={optimizationFilters} 
              onFilterChange={setOptimizationFilters} 
            />
          </div>
          
          <div className="flex-grow w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={filteredOptimizationData} 
                margin={{ top: 5, right: 5, left: -35, bottom: 0 }}
                barGap={0}
              >
                <XAxis 
                  dataKey="name" 
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
                  dataKey="optimized" 
                  stackId="a"
                  name="OPTIMIZED" 
                  fill="#3c6e71" 
                  barSize={24}
                />
                <Bar 
                  dataKey="savings" 
                  stackId="a"
                  name="SAVINGS" 
                  fill={theme === 'light' ? "#000000" : "#ffffff"} 
                  radius={[1, 1, 0, 0]} 
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="space-y-0.5">
                <div className="text-[6px] font-bold text-gray-600 tracking-widest uppercase">Potential Savings</div>
                <div className="text-lg font-serif text-[var(--color-accent-coral)]">$3,420</div>
              </div>
              <div className="w-[1px] h-6 bg-black/5 dark:bg-white/5" />
              <div className="space-y-0.5">
                <div className="text-[6px] font-bold text-gray-600 tracking-widest uppercase">Efficiency Gain</div>
                <div className="text-lg font-serif text-[var(--color-accent-neutral)]">+46%</div>
              </div>
            </div>
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full py-1 px-3 flex items-center justify-center">
              <span className="text-[8px] font-bold tracking-widest uppercase">28% Reduction</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row Grid */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* AWS Cost Monitor */}
        <div className="col-span-6 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400">AWS COST MONITOR</h2>
              <button 
                onClick={handleRefresh}
                className="p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                title="Refresh Data"
              >
                <RefreshCw size={10} className={cn(isRefreshing && "animate-spin")} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setServicePageIndex(prev => Math.max(0, prev - 1))}
                  disabled={servicePageIndex === 0}
                  className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[7px] font-bold text-gray-500 tracking-widest w-8 text-center">
                  {servicePageIndex + 1} / {totalPages}
                </span>
                <button 
                  onClick={() => setServicePageIndex(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={servicePageIndex === totalPages - 1}
                  className="p-1 text-gray-500 disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
              <FilterDropdown 
                theme={theme} 
                align="up" 
                filters={monitorFilters} 
                onFilterChange={setMonitorFilters} 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 flex-grow items-center">
            {currentServices.map((service) => (
              <div key={service.id} className="space-y-2">
                <span className="text-[7px] font-bold text-gray-600 tracking-widest uppercase">{service.name}</span>
                <MiniChart data={service.data} />
                <div className="space-y-0.5">
                  <div className="text-2xl font-serif">${service.cost.toLocaleString()}</div>
                  <div className="text-[7px] font-bold text-gray-600 tracking-widest">USD LAST 30 DAYS</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Report */}
        <div className="col-span-6 bg-[var(--color-card-bg)] rounded-xl p-4 border border-black/5 dark:border-white/5 flex flex-col relative">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[9px] font-bold tracking-[0.2em] text-gray-400 uppercase">Cost Report</h2>
            <FilterDropdown 
              theme={theme} 
              align="up" 
              filters={reportFilters} 
              onFilterChange={setReportFilters} 
            />
          </div>
          
          <div className="flex-grow w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getReportData}>
                <Bar dataKey="value" radius={[1, 1, 0, 0]}>
                  {getReportData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.alert ? "#3c6e71" : (theme === 'light' ? "#000000" : "#ffffff")} 
                      fillOpacity={entry.alert ? 1 : 0.08} 
                    />
                  ))}
                </Bar>
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 8, fontWeight: 700, fill: theme === 'light' ? '#6b7280' : '#4b5563' }}
                  dy={5}
                  interval={reportFilters.aggregate === 'DAILY' ? 3 : 0}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-zinc-900 dark:bg-zinc-900 border border-white/10 p-1.5 rounded text-[9px] font-bold text-white">
                          ${payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');

  return (
    <>
      {view === 'landing' ? (
        <LandingPage onEnterDashboard={() => setView('dashboard')} />
      ) : (
        <Dashboard onBackToLanding={() => setView('landing')} />
      )}
    </>
  );
}
