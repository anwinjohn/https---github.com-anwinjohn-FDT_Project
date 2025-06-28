import { useState, useEffect, useCallback } from 'react';
import { AlertSummary, AlertDetail, AlertFilters, AlertDisposition } from '../types/alerts';
import apiClient from '../utils/apiClient';
import { useNotifications } from '../components/notifications';
import config from '../config/app-config.json';

interface UseAlertsReturn {
  alerts: AlertSummary[];
  selectedAlert: AlertDetail[] | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  filters: AlertFilters;
  fetchAlerts: () => Promise<void>;
  fetchAlertDetails: (alertId: string) => Promise<void>;
  disposeAlert: (disposition: AlertDisposition) => Promise<boolean>;
  updateFilters: (newFilters: Partial<AlertFilters>) => void;
  setPage: (page: number) => void;
  refreshAlerts: () => Promise<void>;
}

const defaultFilters: AlertFilters = {
  search: '',
  service_type: [],
  rule_id: [],
  status: [],
  priority: [],
  date_range: {
    from: '',
    to: ''
  },
  assigned_to: [],
  branch_name: [],
  cust_nationality: []
};

export const useAlerts = (pageSize: number = 20): UseAlertsReturn => {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters);
  const [errorNotificationShown, setErrorNotificationShown] = useState(false);

  const { addNotification } = useNotifications();

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorNotificationShown(false);

      // For now, using the provided API endpoint
      // const response = await fetch('http://127.0.0.1:8000/open-alerts-summary');
      const response = await fetch(`${config.api.baseUrl}/open-alerts-summary`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AlertSummary[] = await response.json();

      // Deduplicate data based on alert_id
      const uniqueAlertsMap = new Map<string, AlertSummary>();
      data.forEach(alert => {
        // If a duplicate alert_id is found, the first one encountered will be kept.
        if (!uniqueAlertsMap.has(alert.alert_id)) {
          uniqueAlertsMap.set(alert.alert_id, alert);
        }
      });
      let processedData = Array.from(uniqueAlertsMap.values());

      // Now, apply client-side filtering and pagination to processedData
      let filteredData = processedData;


      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(alert =>
          alert.cust_name.toLowerCase().includes(searchLower) ||
          alert.rule_desc.toLowerCase().includes(searchLower) ||
          alert.cust_code.includes(searchLower) ||
          alert.rule_id.toLowerCase().includes(searchLower)
        );
      }

      if (filters.service_type.length > 0) {
        filteredData = filteredData.filter(alert =>
          filters.service_type.includes(alert.service_type)
        );
      }

      if (filters.rule_id.length > 0) {
        filteredData = filteredData.filter(alert =>
          filters.rule_id.includes(alert.rule_id)
        );
      }

      // Pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      setAlerts(paginatedData);
      setTotalCount(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(errorMessage);

      // Only show notification once per error state
      if (!errorNotificationShown) {
        addNotification('Failed to load alerts', 'error');
        setErrorNotificationShown(true);
      }

      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, addNotification, errorNotificationShown]);

  const fetchAlertDetails = useCallback(async (alertId: string) => {
    try {
      setLoading(true);
      setError(null);
      setErrorNotificationShown(false);

      const response = await fetch(`${config.api.baseUrl}/open-alerts-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alert_id: alertId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AlertDetail[] = await response.json();
      setSelectedAlert(data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alert details';
      setError(errorMessage);

      // Only show notification once per error state
      if (!errorNotificationShown) {
        addNotification('Failed to load alert details', 'error');
        setErrorNotificationShown(true);
      }

      console.error('Error fetching alert details:', err);
    } finally {
      setLoading(false);
    }
  }, [addNotification, errorNotificationShown]);

  const disposeAlert = useCallback(async (disposition: AlertDisposition): Promise<boolean> => {
    try {
      setLoading(true);
      setErrorNotificationShown(false);

      // In production, this would call the actual API
      const response = await apiClient.post('/api/alerts/dispose', disposition);

      if (response.success) {
        addNotification('Alert disposed successfully', 'success');
        await fetchAlerts(); // Refresh the alerts list
        return true;
      } else {
        throw new Error(response.error || 'Failed to dispose alert');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to dispose alert';
      setError(errorMessage);

      // Only show notification once per error state
      if (!errorNotificationShown) {
        addNotification(errorMessage, 'error');
        setErrorNotificationShown(true);
      }

      console.error('Error disposing alert:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [addNotification, fetchAlerts, errorNotificationShown]);

  const updateFilters = useCallback((newFilters: Partial<AlertFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const refreshAlerts = useCallback(async () => {
    await fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    selectedAlert,
    loading,
    error,
    totalCount,
    currentPage,
    totalPages,
    filters,
    fetchAlerts,
    fetchAlertDetails,
    disposeAlert,
    updateFilters,
    setPage,
    refreshAlerts
  };
};