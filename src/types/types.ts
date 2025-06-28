// API response types
export interface AlertSummary {
  rule_id: string;
  rule_desc: string;
  count: number;
  scenario_logic:string; 
  rule_priority: string;
  active_status: boolean;
}

export interface UserAlertSummary {
  emp_id: string;
  count: number;
  last_violation?: string; // Date of last violation
  rule_ids?: string[]; // List of rule IDs violated
  violation_types?: ViolationType[]; // Types of violations
}

export interface ViolationType {
  rule_id: string;
  rule_desc: string;
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