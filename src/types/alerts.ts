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
  branch_name: string;
  cust_nationality: string;
}

export interface AlertDetail {
  time_stamp: string;
  transaction_date: string;
  service_type: string;
  row_id: string;
  refno_send_receive: string;
  customer_code: string;
  customer_type: string;
  customer_name: string;
  amt_aed: string;
  rule_id: string;
  rule_description: string;
  cashier: string;
  branch_name: string;
  alert_id: string;
  comments: string;
  profession: string;
  customer_natioanlity: string;
  residential_status: string;
  beneficiary_name: string;
  purpose: string;
  source: string;
  relationship: string;
  authorized_by: string;
  is_employee_txn: boolean;
  service: string;
  payment_to_country: string;
  beneficiary_nationality: string;
  transaction_details?: any;
  additional_info?: any;
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
export interface AlertDisposition {
  alert_id: string;
  disposition: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  comments: string;
  assigned_to?: string;
}