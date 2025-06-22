export interface RiskAnalyticsData {
  executive_summary: {
    overall_risk_score: number;
    risk_trend: string;
    top_risk_factors: string[];
    key_findings: string[];
  };
  metadata: {
    report_date: string;
    analysis_period: {
      start: string;
      end: string;
      days_analyzed: number;
    };
    data_quality: {
      completeness_score: number;
      missing_fields: string[];
      data_warnings: string[];
    };
  };
  key_risk_indicators: {
    volume_metrics: {
      total_alerts: number;
      unique_customers: number;
      alerts_per_customer: number;
      high_risk_jurisdiction_tx: number;
      high_risk_professions: number;
    };
    customer_risk: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      new_high_risk_customers: number;
      dormant_reactivated: number;
    };
    geographic_risk: {
      high_risk_jurisdictions: number;
      suspicious_country_pairs: string[];
    };
    branch_risk: {
      high_risk_branches: number;
      top_branch_by_anomalies: string;
      branch_comparison_metrics: Record<string, any>;
    };
  };
  customer_risk_analysis: {
    critical_customers: CriticalCustomer[];
    emerging_risks: {
      new_high_risk_customers: EmergingRiskCustomer[];
      dormant_reactivated: EmergingRiskCustomer[];
    };
  };
  transaction_analysis: {
    pattern_detection: {
      high_frequency: HighFrequencyPattern[];
      high_value: HighValueTransaction[];
      unusual_timing: {
        off_hour_transactions: number;
        weekend_transactions: number;
      };
    };
    amount_analysis: {
      anomaly_detection: {
        total_anomalies: number;
        top_amount_anomalies: AmountAnomaly[];
      };
      round_number_transactions: {
        count: number;
        percentage_of_total: number;
      };
    };
  };
  network_analysis: {
    cluster_analysis: SuspiciousCluster[];
    central_actors: CentralActor[];
    detailed_relationships: DetailedRelationship[];
  };
  temporal_analysis: {
    alert_trends: {
      daily_pattern: DailyPattern[];
      hourly_pattern: HourlyPattern[];
      anomalous_spikes: AnomalousSpike[];
    };
    seasonal_comparison: Record<string, any>;
  };
  predictive_insights: {
    emerging_risk_factors: EmergingRiskFactor[];
    propensity_scores: {
      high_risk_customers: PropensityScore[];
    };
  };
  actionable_recommendations: ActionableRecommendation[];
}

export interface CriticalCustomer {
  customer_id: string;
  name: string;
  profession: string;
  risk_profile: {
    score: number;
    factors: string[];
  };
  activity_summary: {
    alert_count: number;
    beneficiary_count: number;
    total_amount: number;
    transaction_velocity: string;
    amount_pattern: string;
  };
  network_connections: {
    shared_beneficiaries: number;
    cluster_membership: string;
  };
}

export interface EmergingRiskCustomer {
  customer_id: string;
  name: string;
  days_since_first_alert: number;
  alerts_per_day: number;
}

export interface HighFrequencyPattern {
  customer_id: string;
  pattern_type: string;
  characteristics: {
    count: number;
    total_amount: number;
    avg_amount: number;
    service_type: string;
  };
}

export interface HighValueTransaction {
  customer_name: string;
  transaction_type: string;
  characteristics: {
    amount: number;
    counterparties: string[];
    service_type: string;
  };
}

export interface AmountAnomaly {
  customer: string;
  amount: number;
  context: string;
  anomaly_score: number;
}

export interface SuspiciousCluster {
  cluster_id: string;
  risk_score: number;
  characteristics: {
    customer_count: number;
    beneficiary_count: number;
    transaction_pattern: string | null;
    total_transactions: number;
    total_amount: number;
    average_transaction_amount: number;
    time_span_days: number;
    common_attributes: {
      branches: string[];
      countries: string[];
      service_types: string[];
    };
  };
  fraud_indications: string[];
  participants: {
    customers: ClusterParticipant[];
    beneficiaries: ClusterBeneficiary[];
  };
}

export interface ClusterParticipant {
  customer_code: string;
  customer_name: string;
  transaction_count: number;
  total_amount: number;
  profession: string;
}

export interface ClusterBeneficiary {
  beneficiary_name: string;
  transaction_count: number;
  total_amount: number;
  country: string;
  received_from_count: number;
}

export interface CentralActor {
  node_id: string;
  customer_code: string;
  customer_name: string;
  centrality_score: number;
  connection_types: string[];
  risk_implications: string;
  transaction_summary: {
    total_transactions: number;
    total_amount: number;
    beneficiary_count: number;
    top_beneficiaries: TopBeneficiary[];
  };
}

export interface TopBeneficiary {
  name: string;
  transaction_count: number;
  total_amount: number;
  last_transaction: string;
}

export interface DetailedRelationship {
  cluster_id: string;
  customer_code: string;
  customer_name: string;
  beneficiary_name: string;
  transaction_count: number;
  total_amount: number;
  first_transaction: string;
  last_transaction: string;
  average_amount: number;
  common_service_types: Record<string, number>;
  example_transactions: ExampleTransaction[];
}

export interface ExampleTransaction {
  reference_number: string;
  date: string;
  amount: number;
  service_type: string;
  branch: string;
}

export interface DailyPattern {
  date: string;
  alert_count: number;
}

export interface HourlyPattern {
  hour: number;
  count: number;
}

export interface AnomalousSpike {
  date: string;
  count: number;
  deviation_from_normal: string;
  primary_contributors: string[];
}

export interface EmergingRiskFactor {
  factor: string;
  trend: string;
  projected_impact: string;
}

export interface PropensityScore {
  customer_id: string;
  name: string;
  propensity_score: number;
  top_risk_factors: string[];
}

export interface ActionableRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  timeframe: string;
}