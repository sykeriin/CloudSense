import React, { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { cn } from '../utils';
import {
  WidgetConfig,
  MetricType,
  VisualizationType,
  GroupByType,
  TimeRangeType,
  METRIC_OPTIONS,
  VISUALIZATION_OPTIONS,
  GROUP_BY_OPTIONS,
  TIME_RANGE_OPTIONS
} from '../types';
import WidgetRenderer from './WidgetRenderer';

interface WidgetBuilderProps {
  theme: 'light' | 'dark';
  onSave: (config: WidgetConfig) => void;
  onCancel: () => void;
  existingConfig?: WidgetConfig;
}

export default function WidgetBuilder({ theme, onSave, onCancel, existingConfig }: WidgetBuilderProps) {
  const [metric, setMetric] = useState<MetricType>(existingConfig?.metric || 'total_cost');
  const [visualization, setVisualization] = useState<VisualizationType>(existingConfig?.visualization || 'kpi');
  const [groupBy, setGroupBy] = useState<GroupByType>(existingConfig?.group_by || 'none');
  const [timeRange, setTimeRange] = useState<TimeRangeType>(existingConfig?.time_range || '30d');
  const [showPreview, setShowPreview] = useState(true);
  const [textContent, setTextContent] = useState(existingConfig?.content || '');
  const [textTitle, setTextTitle] = useState(existingConfig?.widgetTitle || '');

  const handleSave = () => {
    const config: WidgetConfig = {
      id: existingConfig?.id || `widget-${Date.now()}`,
      metric,
      visualization: metric === 'text_block' ? 'text' : metric === 'logs' ? 'text' : metric === 'ai_current_situation' ? 'text' : visualization,
      group_by: groupBy,
      time_range: timeRange,
      title: metric === 'text_block' ? textTitle || 'Text Block' : metric === 'logs' ? 'System Logs' : metric === 'ai_current_situation' ? 'Current Situation AI Analysis' : METRIC_OPTIONS[metric].label,
      content: metric === 'text_block' ? textContent : undefined,
      widgetTitle: metric === 'text_block' ? textTitle : undefined
    };
    onSave(config);
  };

  const previewConfig: WidgetConfig = {
    id: 'preview',
    metric,
    visualization: metric === 'text_block' ? 'text' : metric === 'logs' ? 'text' : metric === 'ai_current_situation' ? 'text' : visualization,
    group_by: groupBy,
    time_range: timeRange,
    content: textContent,
    widgetTitle: textTitle
  };

  const isTextBlock = metric === 'text_block';
  const isLogs = metric === 'logs';
  const isAIAnalysis = metric === 'ai_current_situation';

  // Determine valid visualizations based on metric
  const getValidVisualizations = (): VisualizationType[] => {
    if (metric === 'text_block' || metric === 'logs' || metric === 'ai_current_situation') return ['text'];
    
    switch (metric) {
      case 'total_cost':
      case 'forecast':
      case 'anomalies':
        return ['kpi', 'bar'];
      case 'cost_trend':
        return ['line', 'bar'];
      case 'cost_by_service':
      case 'cost_by_team':
        return ['bar', 'pie'];
      case 'shared_costs':
        return ['bar'];
      default:
        return ['kpi', 'line', 'bar', 'pie'];
    }
  };

  const validVisualizations = getValidVisualizations();

  // Determine if group_by should be enabled
  const isGroupByEnabled = visualization !== 'kpi';
  
  // Determine if group_by is required
  const isGroupByRequired = visualization === 'pie';

  // Auto-adjust visualization if invalid
  React.useEffect(() => {
    if (!validVisualizations.includes(visualization)) {
      setVisualization(validVisualizations[0]);
    }
  }, [metric]);

  // Auto-adjust group_by based on visualization
  React.useEffect(() => {
    if (visualization === 'kpi' && groupBy !== 'none') {
      setGroupBy('none');
    }
    if (visualization === 'pie' && groupBy === 'none') {
      if (metric === 'cost_by_service') {
        setGroupBy('service');
      } else if (metric === 'cost_by_team') {
        setGroupBy('team');
      } else {
        setGroupBy('service');
      }
    }
  }, [visualization]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div 
        className={cn(
          "rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto",
          theme === 'light' ? "bg-white" : "bg-[#1a1a1a]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-serif">Build Your Widget</h2>
            <p className="text-base text-gray-500 mt-1">Customize metric, visualization, and filters</p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* 1. Metric Selection */}
            <div>
              <label className="block text-base font-bold mb-2 tracking-wider">1. SELECT METRIC</label>
              <div className="space-y-2">
                {(Object.keys(METRIC_OPTIONS) as MetricType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-colors",
                      metric === m
                        ? "border-[var(--color-accent-coral)] bg-[var(--color-accent-coral)]/10"
                        : theme === 'light'
                        ? "border-black/10 hover:bg-black/5"
                        : "border-white/10 hover:bg-white/5"
                    )}
                  >
                    <div className="text-base font-bold">{METRIC_OPTIONS[m].label}</div>
                    <div className="text-sm text-gray-500">{METRIC_OPTIONS[m].description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Block Configuration */}
            {isTextBlock && (
              <>
                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">2. WIDGET TITLE (Optional)</label>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Enter title..."
                    className={cn(
                      "w-full p-3 rounded-lg border bg-transparent text-base outline-none",
                      theme === 'light' ? "border-black/10" : "border-white/10"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">3. TEXT CONTENT</label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter your text content..."
                    rows={6}
                    className={cn(
                      "w-full p-3 rounded-lg border bg-transparent text-base outline-none resize-none",
                      theme === 'light' ? "border-black/10" : "border-white/10"
                    )}
                  />
                </div>
              </>
            )}

            {/* Logs Widget - No Configuration Needed */}
            {isLogs && (
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'light' ? "bg-blue-50 border-blue-200" : "bg-blue-950/30 border-blue-800/30"
              )}>
                  <div className="text-base font-bold mb-2">System Logs Widget</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                  This widget displays real-time system action logs. No configuration needed.
                  The widget will auto-refresh every 3 seconds to show the latest actions.
                </div>
              </div>
            )}

            {isAIAnalysis && (
              <>
                <div className={cn(
                  "p-4 rounded-lg border",
                  theme === 'light' ? "bg-blue-50 border-blue-200" : "bg-blue-950/30 border-blue-800/30"
                )}>
                  <div className="text-base font-bold mb-2">Current Situation AI Analysis</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    This widget asks the AI assistant for a concise summary of the current cloud cost situation,
                    including cost drivers, notable risks, and the next optimization move.
                  </div>
                </div>

                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">2. TIME RANGE</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRangeType)}
                    className={cn(
                      "w-full p-3 rounded-lg border bg-transparent text-base font-bold outline-none cursor-pointer",
                      theme === 'light' ? "border-black/10" : "border-white/10"
                    )}
                  >
                    {(Object.keys(TIME_RANGE_OPTIONS) as TimeRangeType[]).map((t) => (
                      <option key={t} value={t} className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>
                        {TIME_RANGE_OPTIONS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Standard Widget Configuration */}
            {!isTextBlock && !isLogs && !isAIAnalysis && (
              <>
                {/* 2. Visualization Type */}
                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">2. VISUALIZATION TYPE</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(VISUALIZATION_OPTIONS) as VisualizationType[])
                      .filter(v => validVisualizations.includes(v))
                      .map((v) => (
                        <button
                          key={v}
                          onClick={() => setVisualization(v)}
                          className={cn(
                            "p-3 rounded-lg border text-center transition-colors",
                            visualization === v
                              ? "border-[var(--color-accent-coral)] bg-[var(--color-accent-coral)]/10"
                              : theme === 'light'
                              ? "border-black/10 hover:bg-black/5"
                              : "border-white/10 hover:bg-white/5"
                          )}
                        >
                          <div className="text-2xl mb-1">{VISUALIZATION_OPTIONS[v].icon}</div>
                          <div className="text-sm font-bold">{VISUALIZATION_OPTIONS[v].label}</div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* 3. Group By */}
                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">
                    3. GROUP BY {isGroupByRequired && <span className="text-red-500">*</span>}
                    {!isGroupByEnabled && <span className="text-gray-500 text-xs ml-2">(Disabled for KPI)</span>}
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as GroupByType)}
                    disabled={!isGroupByEnabled}
                    className={cn(
                      "w-full p-3 rounded-lg border bg-transparent text-base font-bold outline-none cursor-pointer",
                      theme === 'light' ? "border-black/10" : "border-white/10",
                      !isGroupByEnabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {(Object.keys(GROUP_BY_OPTIONS) as GroupByType[]).map((g) => (
                      <option key={g} value={g} className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>
                        {GROUP_BY_OPTIONS[g]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Time Range */}
                <div>
                  <label className="block text-base font-bold mb-2 tracking-wider">4. TIME RANGE</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRangeType)}
                    className={cn(
                      "w-full p-3 rounded-lg border bg-transparent text-base font-bold outline-none cursor-pointer",
                      theme === 'light' ? "border-black/10" : "border-white/10"
                    )}
                  >
                    {(Object.keys(TIME_RANGE_OPTIONS) as TimeRangeType[]).map((t) => (
                      <option key={t} value={t} className={theme === 'light' ? "bg-white text-black" : "bg-zinc-900 text-white"}>
                        {TIME_RANGE_OPTIONS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Right Column - Preview */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-base font-bold tracking-wider">LIVE PREVIEW</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold transition-colors",
                  theme === 'light' ? "bg-black/5 hover:bg-black/10" : "bg-white/5 hover:bg-white/10"
                )}
              >
                <Eye size={12} />
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Info Box */}
            <div className={cn(
              "mb-3 p-3 rounded-lg border text-sm",
              theme === 'light' ? "bg-blue-50 border-blue-200" : "bg-blue-950/30 border-blue-800/30"
            )}>
              <div className="font-bold mb-1">Current Configuration:</div>
              <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                <div>Metric: {METRIC_OPTIONS[metric].label}</div>
                {!isTextBlock && !isLogs && !isAIAnalysis && (
                  <>
                    <div>Visualization: {VISUALIZATION_OPTIONS[visualization].label}</div>
                    <div>Group By: {GROUP_BY_OPTIONS[groupBy]}</div>
                    <div>Time Range: {TIME_RANGE_OPTIONS[timeRange]}</div>
                  </>
                )}
                {isTextBlock && (
                  <>
                    <div>Title: {textTitle || '(none)'}</div>
                    <div>Content: {textContent ? `${textContent.substring(0, 30)}...` : '(empty)'}</div>
                  </>
                )}
                {isLogs && (
                  <div>Auto-refreshing every 3 seconds</div>
                )}
                {isAIAnalysis && (
                  <>
                    <div>Visualization: Text analysis card</div>
                    <div>Time Range: {TIME_RANGE_OPTIONS[timeRange]}</div>
                    <div>Source: AI assistant summary</div>
                  </>
                )}
              </div>
            </div>
            
            {showPreview && (
              <div 
                className={cn(
                  "rounded-lg border h-[420px]",
                  theme === 'light' ? "bg-[#e5e5e5] border-black/5" : "bg-[#2a2422] border-white/5"
                )}
              >
                <WidgetRenderer config={previewConfig} theme={theme} />
              </div>
            )}

            {!showPreview && (
              <div 
                className={cn(
                  "rounded-lg border h-[420px] flex items-center justify-center",
                  theme === 'light' ? "bg-[#e5e5e5] border-black/5" : "bg-[#2a2422] border-white/5"
                )}
              >
                <div className="text-center text-gray-500">
                  <Eye size={48} className="mx-auto mb-2 opacity-20" />
                  <div className="text-base">Click "Show" to preview</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-black/5 dark:border-white/5">
          <button
            onClick={onCancel}
            className={cn(
              "px-6 py-2 rounded-lg text-base font-bold transition-colors",
              theme === 'light' ? "bg-black/5 hover:bg-black/10" : "bg-white/5 hover:bg-white/10"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-base font-bold bg-[var(--color-accent-coral)] hover:bg-[var(--color-accent-coral)]/80 text-white transition-colors"
          >
            {existingConfig ? 'Update Widget' : 'Add Widget'}
          </button>
        </div>
      </div>
    </div>
  );
}
