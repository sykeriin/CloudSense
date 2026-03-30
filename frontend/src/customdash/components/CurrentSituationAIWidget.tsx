import { useEffect, useState } from 'react';
import { Bot, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import type { TimeRangeType } from '../types';
import { API_BASE_URL } from '../../config/api';

type AssistantSummaryItem = {
  service: string;
  total_cost: number;
  share: number;
};

type AssistantResponse = {
  provider: string;
  model: string;
  answer: string;
  time_frame: string;
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

interface CurrentSituationAIWidgetProps {
  theme: 'light' | 'dark';
  timeRange: TimeRangeType;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });

function mapTimeRange(timeRange: TimeRangeType) {
  switch (timeRange) {
    case '7d':
      return 'past_one_week';
    case '90d':
      return 'past_one_year';
    case '30d':
    default:
      return 'past_one_month';
  }
}

export default function CurrentSituationAIWidget({ theme, timeRange }: CurrentSituationAIWidgetProps) {
  const [data, setData] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async (isManual = false) => {
    try {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE_URL}/assistant/finops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question:
            'Give a concise current situation analysis of cloud spend for this period. Include what is happening now, the top cost drivers, any notable spikes or risks, and the clearest next optimization move.',
          time_frame: mapTimeRange(timeRange),
          services: [],
          force_fallback: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI analysis request failed with status ${response.status}`);
      }

      const parsed = (await response.json()) as AssistantResponse;
      setData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI analysis.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAnalysis();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-base text-gray-500">Generating AI analysis...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-base text-center text-gray-500">{error || 'No AI analysis available'}</div>
      </div>
    );
  }

  const topService = data.summary.top_services[0];

  return (
    <div className="h-full flex flex-col p-4 min-h-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400 uppercase">Current Situation AI Analysis</h2>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500">
            <Bot size={10} />
            <span>{data.provider} {data.model}</span>
          </div>
        </div>
        <button
          onClick={() => void loadAnalysis(true)}
          className={cn(
            "p-1.5 rounded-full transition-colors",
            theme === 'light' ? "hover:bg-black/5" : "hover:bg-white/5"
          )}
          title="Refresh analysis"
        >
          <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className={cn(
        "rounded-lg border p-3 mb-3 shrink-0",
        theme === 'light' ? "bg-white/60 border-black/5" : "bg-black/20 border-white/5"
      )}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500">Observed Cost</div>
            <div className="mt-1 text-2xl font-serif">{money.format(data.summary.total_cost || 0)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500">Average Daily</div>
            <div className="mt-1 text-2xl font-serif">{money.format(data.summary.average_daily_cost || 0)}</div>
          </div>
        </div>
        {data.summary.peak_day && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-gray-500">
            <AlertCircle size={10} />
            <span>Peak day {data.summary.peak_day} at {money.format(data.summary.peak_day_cost || 0)}</span>
          </div>
        )}
      </div>

      <div className={cn(
        "flex-1 min-h-0 rounded-lg border p-4 overflow-y-auto custom-scrollbar",
        theme === 'light' ? "bg-white/60 border-black/5" : "bg-black/20 border-white/5"
      )}>
        <div className="text-[16px] leading-8 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {data.answer}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500">
            {data.history_start_date} to {data.history_end_date}
          </div>
          {topService && (
            <div className="mt-1 text-[12px] text-gray-500 truncate">
              Top driver: <span className="font-bold uppercase tracking-wide">{topService.service}</span> at {money.format(topService.total_cost)} ({(topService.share * 100).toFixed(1)}%)
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-lg border px-3 py-2 shrink-0",
          theme === 'light' ? "bg-white/60 border-black/5" : "bg-black/20 border-white/5"
        )}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Records</div>
          <div className="mt-1 text-[16px] font-serif">{data.summary.total_records}</div>
        </div>
      </div>
    </div>
  );
}
