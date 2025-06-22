import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AlertSummary, UserAlertSummary, BranchAlertSummary, DateRange } from '../types/types';
import config from '../config/app-config.json';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface UseApiReturn {
  alertsSummary: AlertSummary[];
  userAlertsSummary: UserAlertSummary[];
  branchAlertsSummary: BranchAlertSummary[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
}

export const useApi = (dateRange: DateRange, autoRefreshInterval = 60000): UseApiReturn => {
  const [alertsSummary, setAlertsSummary] = useState<AlertSummary[]>([]);
  const [userAlertsSummary, setUserAlertsSummary] = useState<UserAlertSummary[]>([]);
  const [branchAlertsSummary, setBranchAlertsSummary] = useState<BranchAlertSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number>();

  const fetchAlertsSummary = useCallback(async () => {
    try {
      const response = await axios.get<AlertSummary[]>(
        `${API_BASE_URL}/alerts-summary?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setAlertsSummary(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching alerts summary:', err);
      setError('Failed to fetch alerts summary. Please try again later.');
      return false;
    }
  }, [dateRange]);

  const fetchUserAlertsSummary = useCallback(async () => {
    try {
      const response = await axios.get<UserAlertSummary[]>(
        `${API_BASE_URL}/user-alerts-summary?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setUserAlertsSummary(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching user alerts summary:', err);
      setError('Failed to fetch user alerts summary. Please try again later.');
      return false;
    }
  }, [dateRange]);

  const fetchBranchAlertsSummary = useCallback(async () => {
    try {
      const response = await axios.get<BranchAlertSummary[]>(
        `${API_BASE_URL}/branch-alerts-summary?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setBranchAlertsSummary(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching branch alerts summary:', err);
      setError('Failed to fetch branch alerts summary. Please try again later.');
      return false;
    }
  }, [dateRange]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const results = await Promise.all([
      fetchAlertsSummary(),
      fetchUserAlertsSummary(),
      fetchBranchAlertsSummary()
    ]);
    
    setIsLoading(false);
    
    if (results.every(result => result)) {
      setLastUpdated(new Date());
    }
  }, [fetchAlertsSummary, fetchUserAlertsSummary, fetchBranchAlertsSummary]);

  // Initial data fetch
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh setup with cleanup
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      intervalRef.current = window.setInterval(() => {
        refreshData();
      }, autoRefreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshData, autoRefreshInterval]);

  return {
    alertsSummary,
    userAlertsSummary,
    branchAlertsSummary,
    isLoading,
    error,
    lastUpdated,
    refreshData
  };
};