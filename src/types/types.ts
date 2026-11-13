// API response types
export interface AlertSummary {
  rule_id: string;
  rule_desc: string;
  count: number;
  scenario_logic: string;
  rule_priority: string;
  active_status: boolean;
}

export interface UserAlertSummaryBase {
  emp_id: string;
  emp_name: string;
  count: number;
  last_violation?: string; // Date of last violation
  rule_ids?: string[]; // List of rule IDs violated
  violation_types?: ViolationType[]; // Types of violations
}

export interface UserAlertSummary {
  high_risk_cashiers_count: number;
  total_cashiers: number;
  date_range: {
    from_date: string;
    to_date: string;
  };
  avg_violations: string;
  cashiers: UserAlertSummaryBase[];
}
export interface ViolationType {
  category: string;
  count: number;
  percentOfTotal: number;
}

export interface BranchAlertSummary {
  branch_name: string;
  count: number;
}

export interface BranchAlertDetails {
  branch_name: string;
  risk_level: string;
  risk_score: number;
  risk_percentage: number;
  risk_rank: string;
  total_alerts: number;
  total_rows: number;
  unique_cashiers: number;
  unique_customers: number;
  total_exposure: number;
  last_alert_date: string;
  top_rule: string;
}

// Dashboard state types
export interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface DashboardData {
  alertsSummary: AlertSummary[];
  userAlertsSummary: UserAlertSummary[];
  branchAlertsSummary: BranchAlertSummary[];
  branchAlertDetails: BranchAlertDetails[];
  violationType: ViolationType[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
export interface FraudVolume {
  /** Start of the API time bucket. Older responses use generatedAt instead. */
  period?: string;
  generatedAt: string;
  alertsRaised: number;
  confirmedFraud: number;
  falsePositives: number;
  /** Pending alert count returned by the fraud-volume endpoint. */
  pendingAlerts?: number;
  /** Backward-compatible alias if the API returns this field name. */
  pendingCount?: number;
}
