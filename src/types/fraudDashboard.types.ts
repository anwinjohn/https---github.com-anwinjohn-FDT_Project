// types/fraudDashboard.types.ts
//
// Contracts for the Management Dashboard (Fraud Trend) feature.
// These are additive types — nothing here overlaps with or mutates
// the existing AlertRule / DateRange types already used by Dashboard.tsx.

export type TrendDirection = 'up' | 'down' | 'flat';

/** A single headline KPI tile (e.g. "Total Fraud Alerts") */
export interface FraudKpi {
  id: string;
  label: string;
  value: number;
  /** Pre-formatted display value, e.g. "$482,300" or "3.2%" — API owns formatting rules */
  displayValue: string;
  unit: 'count' | 'percent' | 'currency' | 'hours';
  changePct: number; // vs previous period, e.g. -12.4
  trend: TrendDirection;
  /** true when a rising value is a bad outcome (e.g. False Positive Rate) — drives color */
  inverse?: boolean;
  sparkline: number[]; // last N periods, for the tiny inline chart
}

/** One point on the Fraud Trend time series */
export interface FraudTrendPoint {
  period: string; // ISO date, daily or weekly bucket depending on granularity
  alertsRaised: number;
  confirmedFraud: number;
  falsePositives: number;
  pendingAlerts: number;
  financialExposure: number; // currency, amount at risk
  financialPrevented: number; // currency, amount blocked/recovered
}

/** Operational / SLA performance block */
export interface OperationalPerformance {
  avgTriageTimeMinutes: number;
  avgResolutionTimeHours: number;
  slaComplianceRate: number; // percent
  analystCaseload: number; // avg open cases per analyst
  backlogCount: number;
  reviewedWithinSla: number;
  reviewedOutsideSla: number;
  topPerformingBranch: { name: string; resolutionRate: number };
  laggingBranch: { name: string; resolutionRate: number };
}

/** Fraud mix by category, for the composition chart */
export interface FraudCategoryBreakdown {
  category: string;
  count: number;
  percentOfTotal: number;
}

export interface FraudDashboardFilters {
  startDate: string; // ISO date
  endDate: string; // ISO date
  branchId?: string;
  riskLevel?: 'All' | 'High' | 'Medium' | 'Low';
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export interface FraudDashboardResponse {
  generatedAt: string; // ISO timestamp
  period: { startDate: string; endDate: string; granularity: string };
  kpis: FraudKpi[];
  trend: FraudTrendPoint[];
  operational: OperationalPerformance;
  categoryBreakdown: FraudCategoryBreakdown[];
}
