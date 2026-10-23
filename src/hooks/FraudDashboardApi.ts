// services/fraudDashboardApi.ts
//
// MOCK implementation of the Management Dashboard (Fraud Trend) API.
// This does NOT touch the existing `useApi` hook or any live endpoint —
// it's a standalone service so the new panel can be demoed/tested today
// and swapped for a real HTTP call later with zero changes to the component.
//
// ---------------------------------------------------------------------------
// REAL ENDPOINT CONTRACT (for backend team)
//
//   GET /api/v1/dashboards/fraud-trend
//
//   Query params:
//     startDate    string  ISO date, required
//     endDate      string  ISO date, required
//     branchId     string  optional, filter to a single branch
//     riskLevel    'All' | 'High' | 'Medium' | 'Low'   optional, default 'All'
//     granularity  'daily' | 'weekly' | 'monthly'      optional, default 'weekly'
//
//   200 response body: FraudDashboardResponse (see types/fraudDashboard.types.ts)
//
//   Example:
//   GET /api/v1/dashboards/fraud-trend?startDate=2026-06-24&endDate=2026-07-24&granularity=weekly
// ---------------------------------------------------------------------------

import {
  FraudDashboardFilters,
  FraudDashboardResponse,
} from '../types/fraudDashboard.types';

const rand = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

function buildMockTrend(weeks: number) {
  const points = [];
  const start = new Date();
  start.setDate(start.getDate() - weeks * 7);

  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    const alertsRaised = rand(180, 420);
    const confirmedFraud = Math.round(alertsRaised * (rand(18, 32) / 100));
    const falsePositives = Math.round(alertsRaised * (rand(8, 18) / 100));
    points.push({
      period: d.toISOString().slice(0, 10),
      alertsRaised,
      confirmedFraud,
      falsePositives,
      financialExposure: rand(80, 260) * 1000,
      financialPrevented: rand(60, 220) * 1000,
    });
  }
  return points;
}

/**
 * Fetches Fraud Trend dashboard data.
 * Currently mocked with a simulated network delay; swap the body of this
 * function for a real `apiClient.get('/dashboards/fraud-trend', { params })`
 * call once the backend endpoint above is available. The return shape
 * (FraudDashboardResponse) is designed to match 1:1 so no component changes
 * will be needed at that point.
 */
export async function fetchFraudDashboard(
  filters: FraudDashboardFilters
): Promise<FraudDashboardResponse> {
  await new Promise((resolve) => setTimeout(resolve, 550)); // simulate latency

  const trend = buildMockTrend(12);
  const totalAlerts = trend.reduce((s, p) => s + p.alertsRaised, 0);
  const totalConfirmed = trend.reduce((s, p) => s + p.confirmedFraud, 0);
  const totalFalsePos = trend.reduce((s, p) => s + p.falsePositives, 0);
  const totalPrevented = trend.reduce((s, p) => s + p.financialPrevented, 0);

  const response: FraudDashboardResponse = {
    generatedAt: new Date().toISOString(),
    period: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      granularity: filters.granularity || 'weekly',
    },
    kpis: [
      {
        id: 'total_alerts',
        label: 'Total Fraud Alerts',
        value: totalAlerts,
        displayValue: totalAlerts.toLocaleString(),
        unit: 'count',
        changePct: 8.4,
        trend: 'up',
        sparkline: trend.map((p) => p.alertsRaised),
      },
      {
        id: 'confirmed_fraud',
        label: 'Confirmed Fraud Cases',
        value: totalConfirmed,
        displayValue: totalConfirmed.toLocaleString(),
        unit: 'count',
        changePct: -4.1,
        trend: 'down',
        sparkline: trend.map((p) => p.confirmedFraud),
      },
      {
        id: 'detection_rate',
        label: 'Detection Rate',
        value: 94.2,
        displayValue: '94.2%',
        unit: 'percent',
        changePct: 1.6,
        trend: 'up',
        sparkline: trend.map(() => rand(90, 97)),
      },
      {
        id: 'false_positive_rate',
        label: 'False Positive Rate',
        value: Number(((totalFalsePos / totalAlerts) * 100).toFixed(1)),
        displayValue: `${((totalFalsePos / totalAlerts) * 100).toFixed(1)}%`,
        unit: 'percent',
        changePct: -2.3,
        trend: 'down',
        inverse: true,
        sparkline: trend.map((p) => p.falsePositives),
      },
      {
        id: 'financial_prevented',
        label: 'Financial Loss Prevented',
        value: totalPrevented,
        displayValue: `$${(totalPrevented / 1000).toFixed(0)}K`,
        unit: 'currency',
        changePct: 14.9,
        trend: 'up',
        sparkline: trend.map((p) => p.financialPrevented),
      },
      {
        id: 'avg_resolution',
        label: 'Avg. Resolution Time',
        value: 6.4,
        displayValue: '6.4 hrs',
        unit: 'hours',
        changePct: -9.2,
        trend: 'down',
        sparkline: trend.map(() => rand(5, 9)),
      },
    ],
    trend,
    operational: {
      avgTriageTimeMinutes: 18,
      avgResolutionTimeHours: 6.4,
      slaComplianceRate: 91.3,
      analystCaseload: 27,
      backlogCount: 64,
      reviewedWithinSla: 1042,
      reviewedOutsideSla: 99,
      topPerformingBranch: {
        name: 'Dubai — Marina Branch',
        resolutionRate: 97.8,
      },
      laggingBranch: {
        name: 'Sharjah — Industrial Branch',
        resolutionRate: 78.1,
      },
    },
    categoryBreakdown: [
      { category: 'Card Not Present', count: 412, percentOfTotal: 31 },
      { category: 'Account Takeover', count: 298, percentOfTotal: 22 },
      { category: 'Identity Theft', count: 231, percentOfTotal: 17 },
      { category: 'Wire Fraud', count: 189, percentOfTotal: 14 },
      { category: 'Money Laundering', count: 134, percentOfTotal: 10 },
      { category: 'Other', count: 81, percentOfTotal: 6 },
    ],
  };

  return response;
}
