// API response types
export interface AlertSummary {
  rule_id: string;
  rule_desc: string;
  count: number;
  riskCategory: 'High' | 'Medium' | 'Low'; // Added risk category from API
}

export interface UserAlertSummary {
  emp_id: string;
  count: number;
}

export interface BranchAlertSummary {
  branch_name: string;
  count: number;
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
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}