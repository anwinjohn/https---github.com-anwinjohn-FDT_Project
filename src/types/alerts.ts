export interface AlertSummary {
  alert_id: string;
  time_stamp: string;
  service_type: string;
  cust_code: string;
  cust_name: string;
  rule_id: string;
  rule_desc: string;
  rule_remarks: string;
  status: string;
  rule_priority: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AlertDetail {
  time_stamp: string;
  transaction_date: string;
  service_type: string;
  row_id: string;
  ref_no: string;
  cust_code: string;
  cust_type: string;
  cust_name: string;
  lcy_amt: string;
  rule_id: string;
  rule_desc: string;
  cashier_id: string;
  branch_name: string;
  alert_id: string;
  rule_remarks: string;
  cust_profession: string;
  cust_nationality: string;
  cust_resi_status: string;
  beneficiary_name: string;
  txn_purpose: string;
  source_fund: string;
  relationship: string;
  txn_auth_by: string;
  is_emp_txn: boolean;
  txn_service: string;
  pymnt_to_country: string;
  benf_nationality: string;
}

export interface AlertDisposition {
  alert_id: string;
  disposition_type: 'TRUE_POSITIVE' | 'FALSE_POSITIVE';
  risk_category: 'HIGH' | 'MEDIUM' | 'LOW';
  findings: string;
  remarks: string;
  action_taken: string;
  escalated: boolean;
  escalation_reason?: string;
  reviewed_by: string;
  reviewed_at: string;
  supporting_documents?: string[];
  follow_up_required: boolean;
  follow_up_date?: string;
  compliance_notes?: string;
}

export interface AlertFilters {
  search: string;
  service_type: string[];
  rule_id: string[];
  status: string[];
  priority: string[];
  date_range: {
    from: string;
    to: string;
  };
  assigned_to: string[];
  branch_name: string[];
  cust_nationality: string[];
}

export interface AlertAuditLog {
  id: string;
  alert_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}