import { useState, useEffect, useCallback } from 'react';
import { RiskAnalyticsData } from '../types/riskAnalytics';
import { DateRange } from '../types/types';
import { appConfig as config } from '../config/runtime-config';
import { logger } from '../utils/logger';

interface UseRiskAnalyticsReturn {
  data: RiskAnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
}

export const useRiskAnalytics = (dateRange: DateRange): UseRiskAnalyticsReturn => {
  const [data, setData] = useState<RiskAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRiskAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${config.api.baseUrl}/risk-analytics?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      else{
        logger.error('useRiskAnalytics', 'fetchRiskAnalytics', `API responded with status ${response.status}`);
      }

      const analyticsData: RiskAnalyticsData = await response.json();
      setData(analyticsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching risk analytics:', err);
      setError('Failed to fetch risk analytics data. Please try again later.');
      
      // Mock data for development/demo purposes
      const mockData: RiskAnalyticsData = {
        metadata: {
          report_date: "2023-08-01 12:00:00",
          period_start: "2023-05-01",
          period_end: "2023-07-31"
        },
        key_risk_indicators: {
          total_alerts: 1000,
          high_risk_customers: {
            critical: 5,
            high: 15,
            medium: 30,
            low: 950
          },
          high_risk_jurisdiction_transactions: 25,
          high_risk_branches: 3
        },
        customer_risk_analysis: {
          critical_customers: [
            {
              customer_name: "JOHN DOE",
              profession: "LABORER",
              alert_count: 15,
              beneficiary_count: 8,
              total_amount: 125000
            },
            {
              customer_name: "SARAH WILSON",
              profession: "TRADER",
              alert_count: 12,
              beneficiary_count: 6,
              total_amount: 98000
            },
            {
              customer_name: "MICHAEL CHEN",
              profession: "CONSULTANT",
              alert_count: 10,
              beneficiary_count: 4,
              total_amount: 87500
            }
          ]
        },
        branch_risk_analysis: {
          high_risk_branches: [
            {
              branch_name: "MAIN BRANCH",
              risk_score: 0.85,
              high_risk_customers: 12,
              high_risk_jurisdiction_transactions: 8
            },
            {
              branch_name: "DOWNTOWN BRANCH",
              risk_score: 0.72,
              high_risk_customers: 8,
              high_risk_jurisdiction_transactions: 5
            },
            {
              branch_name: "AIRPORT BRANCH",
              risk_score: 0.68,
              high_risk_customers: 6,
              high_risk_jurisdiction_transactions: 3
            }
          ]
        },
        transaction_pattern_analysis: {
          high_frequency_patterns: [
            {
              customer_id: "CUST123",
              service_type: "FUNDS TRANSFER",
              transaction_count: 12,
              total_amount: 45000
            },
            {
              customer_id: "CUST456",
              service_type: "WIRE TRANSFER",
              transaction_count: 8,
              total_amount: 67000
            }
          ],
          high_value_transactions: [
            {
              customer_name: "JANE SMITH",
              beneficiary_name: "ABC COMPANY",
              amount: 50000,
              service_type: "WIRE TRANSFER"
            },
            {
              customer_name: "ROBERT JONES",
              beneficiary_name: "XYZ TRADING",
              amount: 75000,
              service_type: "FUNDS TRANSFER"
            }
          ]
        },
        network_analysis: {
          suspicious_clusters: [
            {
              customer_count: 5,
              beneficiary_count: 3,
              total_transactions: 25,
              total_amount: 150000,
              common_branches: ["MAIN BRANCH", "DOWNTOWN BRANCH"],
              common_countries: ["United Arab Emirates", "India"]
            },
            {
              customer_count: 3,
              beneficiary_count: 2,
              total_transactions: 18,
              total_amount: 95000,
              common_branches: ["AIRPORT BRANCH"],
              common_countries: ["Pakistan", "Bangladesh"]
            }
          ]
        },
        recommendations: [
          "Perform enhanced due diligence on critical-risk customers",
          "Conduct branch audits for high-risk branches",
          "Implement transaction monitoring for high-risk professions and nationalities",
          "Review and update customer risk scoring models",
          "Enhance monitoring for suspicious transaction clusters"
        ]
      };
      
      setData(mockData);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const refreshData = useCallback(async () => {
    await fetchRiskAnalytics();
  }, [fetchRiskAnalytics]);

  useEffect(() => {
    fetchRiskAnalytics();
  }, [fetchRiskAnalytics]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refreshData
  };
};
