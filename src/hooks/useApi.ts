import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  AlertSummary,
  UserAlertSummary,
  BranchAlertSummary,
  DateRange,
  ViolationType,
  BranchAlertDetails,
  FraudVolume,
} from '../types/types';
import { appConfig as config } from '../config/runtime-config';

const API_BASE_URL = config.api?.baseUrl;

interface UseApiReturn {
  alertsSummary: AlertSummary[];
  userAlertsSummary: UserAlertSummary[];
  branchAlertsSummary: BranchAlertSummary[];
  branchAlertDetails: BranchAlertDetails[];
  violationType: ViolationType[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
  useFraudVolume: FraudVolume[];
}

export const useApi = (
  dateRange: DateRange,
  autoRefreshInterval = 0
): UseApiReturn => {
  const [alertsSummary, setAlertsSummary] = useState<AlertSummary[]>([]);
  const [userAlertsSummary, setUserAlertsSummary] = useState<
    UserAlertSummary[]
  >([]);
  const [branchAlertsSummary, setBranchAlertsSummary] = useState<
    BranchAlertSummary[]
  >([]);
  const [branchAlertDetails, setBranchAlertDetails] = useState<
    BranchAlertDetails[]
  >([]);
  const [violationType, setViolationTypes] = useState<ViolationType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number>();
  const [useFraudVolume, setUseFraudVolume] = useState<FraudVolume[]>([]);

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
      // console.log(response.data);
      setUserAlertsSummary(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching user alerts summary:', err);
      setError('Failed to fetch user alerts summary. Please try again later.');
      return false;
    }
  }, [dateRange]);

  // const fetchBranchAlertsSummary = useCallback(async () => {
  //   try {
  //     const response = await axios.get<BranchAlertSummary[]>(
  //       `${API_BASE_URL}/branch-alerts-summary?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
  //     );
  //     setBranchAlertsSummary(response.data);
  //     return true;
  //   } catch (err) {
  //     console.error('Error fetching branch alerts summary:', err);
  //     setError('Failed to fetch branch alerts summary. Please try again later.');
  //     return false;
  //   }
  // }, [dateRange]);

  const fetchBranchAlertsSummary = useCallback(async () => {
    try {
      const response = await axios.get<BranchAlertDetails[]>(
        `${API_BASE_URL}/branch-risk-data?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setBranchAlertDetails(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching branch alerts details:', err);
      setError(
        'Failed to fetch branch alerts details. Please try again later.'
      );
      return false;
    }
  }, [dateRange]);

  const fetchFraudVolume = useCallback(async () => {
    try {
      const response = await axios.get<FraudVolume[]>(
        `${API_BASE_URL}/fraud-volume?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setUseFraudVolume(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching branch alerts details:', err);
      setError(
        'Failed to fetch branch alerts details. Please try again later.'
      );
      return false;
    }
  }, [dateRange]);

  const fetchViolationTypes = useCallback(async () => {
    try {
      const response = await axios.get<ViolationType[]>(
        `${API_BASE_URL}/fraud-violation-type?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`
      );
      setViolationTypes(response.data);
      return true;
    } catch (err) {
      console.error('Error fetching violation types list:', err);
      setError('Failed to fetch violation types list. Please try again later.');
      return false;
    }
  }, [dateRange]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const results = await Promise.all([
      fetchAlertsSummary(),
      fetchUserAlertsSummary(),
      fetchBranchAlertsSummary(),
      fetchViolationTypes(),
      fetchFraudVolume(),
    ]);

    setIsLoading(false);

    if (results.every((result) => result)) {
      setLastUpdated(new Date());
    }
  }, [
    fetchAlertsSummary,
    fetchUserAlertsSummary,
    fetchBranchAlertsSummary,
    fetchViolationTypes,
    fetchFraudVolume,
  ]);

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
    branchAlertDetails,
    violationType,
    isLoading,
    error,
    lastUpdated,
    refreshData,
    useFraudVolume,
  };
};
