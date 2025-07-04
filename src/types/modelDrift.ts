export interface DriftMetric {
  id: string;
  date: string;
  feature: string;
  metric: string;
  value: number;
  threshold: number;
  alert: boolean;
  model_id?: string;
  model_version?: string;
  environment?: string;
  category?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: string;
  created_at: string;
  last_trained: string;
  status: 'active' | 'inactive' | 'deprecated';
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    auc: number;
  };
}

export interface FeatureDrift {
  feature: string;
  current_value: number;
  reference_value: number;
  drift_score: number;
  p_value: number;
  is_drift: boolean;
}

export interface ModelDriftSummary {
  model_id: string;
  model_name: string;
  model_version: string;
  analysis_date: string;
  drift_detected: boolean;
  overall_drift_score: number;
  feature_drifts: FeatureDrift[];
  performance_metrics: {
    current: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      auc: number;
    };
    reference: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      auc: number;
    };
    degradation: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      auc: number;
    };
  };
  recommendations: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }[];
}

export interface DriftTimeSeriesPoint {
  timestamp: string;
  value: number;
  feature?: string;
  metric?: string;
  is_alert?: boolean;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  drift_contribution: number;
}

export interface DriftThreshold {
  metric: string;
  threshold: number;
  description: string;
}

export interface ModelDriftConfig {
  model_id: string;
  monitoring_frequency: 'hourly' | 'daily' | 'weekly';
  reference_dataset: string;
  thresholds: DriftThreshold[];
  notification_settings: {
    email_alerts: boolean;
    slack_alerts: boolean;
    alert_threshold: 'all' | 'high_only';
    recipients: string[];
  };
}