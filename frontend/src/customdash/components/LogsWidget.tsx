import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../utils';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface LogEntry {
  id: string;
  timestamp: number;
  action: string;
  service: string;
  status: 'executed' | 'skipped' | 'failed' | 'executing';
  message: string;
}

interface LogsWidgetProps {
  theme: 'light' | 'dark';
}

export default function LogsWidget({ theme }: LogsWidgetProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/logs`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchLogs, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'executed':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'failed':
        return <XCircle size={14} className="text-red-500" />;
      case 'skipped':
        return <AlertCircle size={14} className="text-yellow-500" />;
      case 'executing':
        return <Clock size={14} className="text-blue-500" />;
      default:
        return <Activity size={14} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'skipped':
        return 'text-yellow-500';
      case 'executing':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-base text-gray-500">Loading logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-base text-gray-500">Error loading logs</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold tracking-[0.2em] text-gray-400">SYSTEM LOGS</h2>
        <div className="flex items-center gap-1 text-[12px] text-gray-500">
          <Activity size={10} />
          <span>LIVE</span>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-center text-base text-gray-500 py-8">
            No actions logged yet
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "p-2 rounded border transition-colors",
                theme === 'light' 
                  ? "bg-white/50 border-black/5 hover:bg-white/80" 
                  : "bg-black/20 border-white/5 hover:bg-black/30"
              )}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(log.status)}
                  <span className="text-[12px] font-bold tracking-wider text-gray-500">
                    {log.service}
                  </span>
                  <span className={cn("text-[12px] font-bold uppercase", getStatusColor(log.status))}>
                    {log.status}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 font-mono">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>

              {/* Action */}
              <div className="text-[14px] font-bold mb-1 text-gray-700 dark:text-gray-300">
                {log.action.replace(/_/g, ' ').toUpperCase()}
              </div>

              {/* Message */}
              <div className="text-[13px] text-gray-600 dark:text-gray-400">
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
