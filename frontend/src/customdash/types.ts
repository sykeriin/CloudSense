export type MetricType = 
  | 'total_cost'
  | 'cost_trend'
  | 'cost_by_service'
  | 'cost_by_team'
  | 'forecast'
  | 'anomalies'
  | 'shared_costs'
  | 'text_block'
  | 'logs'
  | 'ai_current_situation';

export type VisualizationType = 
  | 'kpi'
  | 'line'
  | 'bar'
  | 'pie'
  | 'text';

export type GroupByType = 
  | 'none'
  | 'service'
  | 'team'
  | 'date';

export type TimeRangeType = 
  | '7d'
  | '30d'
  | '90d';

export interface WidgetConfig {
  id: string;
  metric: MetricType;
  visualization: VisualizationType;
  group_by: GroupByType;
  time_range: TimeRangeType;
  title?: string;
  content?: string;
  widgetTitle?: string;
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
  minimized: boolean;
}

export const METRIC_OPTIONS: Record<MetricType, { label: string; description: string; endpoint: string }> = {
  total_cost: {
    label: 'Total Cost',
    description: 'Total cloud spending',
    endpoint: '/dashboard/summary'
  },
  cost_trend: {
    label: 'Cost Trend',
    description: 'Historical cost trends',
    endpoint: '/dashboard/cost-allocation'
  },
  cost_by_service: {
    label: 'Cost by Service',
    description: 'Breakdown by AWS service',
    endpoint: '/dashboard/cost-allocation'
  },
  cost_by_team: {
    label: 'Cost by Team',
    description: 'Cost allocation by team',
    endpoint: '/dashboard/cost-allocation'
  },
  forecast: {
    label: 'Forecast',
    description: 'Projected future costs',
    endpoint: '/dashboard/forecast'
  },
  anomalies: {
    label: 'Anomalies',
    description: 'Cost anomalies and savings',
    endpoint: '/dashboard/insights'
  },
  shared_costs: {
    label: 'Shared Costs',
    description: 'Shared infrastructure costs',
    endpoint: '/dashboard/shared-costs'
  },
  text_block: {
    label: 'Text Block',
    description: 'Custom text widget',
    endpoint: ''
  },
  logs: {
    label: 'System Logs',
    description: 'Real-time action logs',
    endpoint: '/dashboard/logs'
  },
  ai_current_situation: {
    label: 'Current Situation AI Analysis',
    description: 'AI summary of the current cloud cost situation',
    endpoint: '/assistant/finops'
  }
};

export const VISUALIZATION_OPTIONS: Record<VisualizationType, { label: string; icon: string }> = {
  kpi: { label: 'KPI Card', icon: '#' },
  line: { label: 'Line Chart', icon: '~' },
  bar: { label: 'Bar Chart', icon: '|' },
  pie: { label: 'Pie Chart', icon: 'O' },
  text: { label: 'Text Block', icon: 'T' }
};

export const GROUP_BY_OPTIONS: Record<GroupByType, string> = {
  none: 'None',
  service: 'Service',
  team: 'Team',
  date: 'Date'
};

export const TIME_RANGE_OPTIONS: Record<TimeRangeType, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days'
};
