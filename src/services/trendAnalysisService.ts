import axios from 'axios';
import { DateRange } from '../types/types';
import { appConfig as config } from '../config/runtime-config';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface DailyTrendPoint {
  date: string; // ISO date, e.g. '2026-08-13'
  total_alerts: number;
  critical_alerts: number;
  resolved_alerts: number;
}

export interface SeveritySlice {
  severity: Severity;
  count: number;
}

export interface RuleBreakdownItem {
  rule_id: string;
  rule_name: string;
  count: number;
  change_pct: number; // vs. previous period, e.g. 12.5 or -8.2
  severity: Severity;
}

export interface ResolutionPoint {
  date: string;
  avg_resolution_hours: number;
}

export interface TrendAnalysisData {
  period_start: string;
  period_end: string;
  total_alerts: number;
  alerts_change_pct: number;
  avg_resolution_hours: number;
  resolution_change_pct: number;
  daily_trend: DailyTrendPoint[];
  severity_distribution: SeveritySlice[];
  rule_breakdown: RuleBreakdownItem[];
  resolution_trend: ResolutionPoint[];
}

const dates30d = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-08-26');
  d.setDate(d.getDate() - (29 - i));
  return d.toISOString().slice(0, 10);
});

// A realistic 30-day pattern including a mid-period spike (e.g. a card-testing
// incident), tapering back to baseline after mitigation on day ~24.
const totalPattern = [
  62, 58, 65, 71, 60, 55, 68, 74, 70, 66, 73, 88, 112, 134, 121, 98, 84, 79, 76,
  72, 69, 65, 61, 58, 60, 63, 59, 57, 62, 60,
];
const criticalRatio = [
  0.15, 0.14, 0.16, 0.15, 0.13, 0.12, 0.17, 0.18, 0.16, 0.15, 0.19, 0.24, 0.31,
  0.35, 0.33, 0.27, 0.21, 0.18, 0.16, 0.15, 0.14, 0.13, 0.14, 0.13, 0.14, 0.15,
  0.13, 0.12, 0.14, 0.13,
];
const resolvedRatio = [
  0.82, 0.85, 0.83, 0.8, 0.86, 0.88, 0.81, 0.78, 0.8, 0.83, 0.76, 0.7, 0.62,
  0.58, 0.65, 0.72, 0.78, 0.82, 0.84, 0.85, 0.87, 0.88, 0.86, 0.87, 0.85, 0.86,
  0.88, 0.89, 0.87, 0.88,
];
const resolutionHours = [
  4.2, 4.0, 4.4, 4.6, 4.1, 3.8, 4.3, 4.8, 4.5, 4.2, 5.1, 6.4, 8.9, 10.2, 9.1,
  7.3, 5.8, 5.0, 4.6, 4.3, 4.0, 3.9, 4.1, 3.8, 4.0, 4.2, 3.9, 3.7, 4.0, 3.9,
];

const MOCK_TREND_DATA: TrendAnalysisData = {
  period_start: dates30d[0],
  period_end: dates30d[dates30d.length - 1],
  total_alerts: totalPattern.reduce((a, b) => a + b, 0),
  alerts_change_pct: 8.4,
  avg_resolution_hours: 4.6,
  resolution_change_pct: -6.1,
  daily_trend: dates30d.map((date, i) => ({
    date,
    total_alerts: totalPattern[i],
    critical_alerts: Math.round(totalPattern[i] * criticalRatio[i]),
    resolved_alerts: Math.round(totalPattern[i] * resolvedRatio[i]),
  })),
  severity_distribution: [
    { severity: 'critical', count: 118 },
    { severity: 'high', count: 246 },
    { severity: 'medium', count: 512 },
    { severity: 'low', count: 389 },
  ],
  rule_breakdown: [
    {
      rule_id: 'R-014',
      rule_name: 'Structuring Detection',
      count: 214,
      change_pct: 22.4,
      severity: 'critical',
    },
    {
      rule_id: 'R-032',
      rule_name: 'Velocity Check — High Frequency',
      count: 186,
      change_pct: 14.1,
      severity: 'high',
    },
    {
      rule_id: 'R-007',
      rule_name: 'Cross-Border High Value',
      count: 163,
      change_pct: -4.8,
      severity: 'high',
    },
    {
      rule_id: 'R-051',
      rule_name: 'Beneficiary Network Anomaly',
      count: 142,
      change_pct: 9.6,
      severity: 'medium',
    },
    {
      rule_id: 'R-019',
      rule_name: 'Dormant Account Reactivation',
      count: 97,
      change_pct: -11.2,
      severity: 'medium',
    },
    {
      rule_id: 'R-044',
      rule_name: 'Off-Hours Transaction Pattern',
      count: 88,
      change_pct: 3.2,
      severity: 'low',
    },
    {
      rule_id: 'R-032',
      rule_name: 'Velocity Check — High Frequency',
      count: 186,
      change_pct: 14.1,
      severity: 'high',
    },
    {
      rule_id: 'R-007',
      rule_name: 'Cross-Border High Value',
      count: 163,
      change_pct: -4.8,
      severity: 'high',
    },
    {
      rule_id: 'R-051',
      rule_name: 'Beneficiary Network Anomaly',
      count: 142,
      change_pct: 9.6,
      severity: 'medium',
    },
    {
      rule_id: 'R-019',
      rule_name: 'Dormant Account Reactivation',
      count: 97,
      change_pct: -11.2,
      severity: 'medium',
    },
    {
      rule_id: 'R-044',
      rule_name: 'Off-Hours Transaction Pattern',
      count: 88,
      change_pct: 3.2,
      severity: 'low',
    },
  ],
  resolution_trend: dates30d.map((date, i) => ({
    date,
    avg_resolution_hours: resolutionHours[i],
  })),
};


export const FALLBACK_TREND_ANALYSIS_DATA: TrendAnalysisData = MOCK_TREND_DATA;

export const fetchTrendAnalysis = async (dateRange: DateRange): Promise<TrendAnalysisData> => {
  const baseUrl = config.api?.baseUrl;
  const response = await axios.get<TrendAnalysisData>(
    `${baseUrl}/trend-analysis?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
  );
  return response.data;
};
