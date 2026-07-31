import { useState, useEffect, useCallback } from 'react';
import {
  AlertSummary,
  AlertDetail,
  AlertFilters,
  AlertDisposition,
  AlertDetailsResponse,
} from '../types/alerts';
import apiClient from '../utils/apiClient';
import { useNotifications } from '../components/notifications';
import { appConfig as config } from '../config/runtime-config';
import FilterOptionsAPI from './FilterOptionsAPI';

interface AlertsResponse {
  total: number;
  page: number;
  page_size: number;
  rule_priority: string | null;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  current_page: number;
  total_open_alerts: number;
  total_high_priority_alerts: number;
  pending_review_count: number;
  data: AlertSummary[];
}

interface UseAlertsReturn {
  alerts: AlertSummary[];
  selectedAlert: AlertDetailsResponse | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  totalOpenAlerts: number;
  pendingReview: number;
  totalHighPriorityAlerts: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  pageSize: number;
  filters: AlertFilters;
  filterOptions: {
    serviceTypes: string[];
    ruleIds: string[];
    statuses: string[];
    priorities: string[];
    assignees: string[];
    branches: string[];
    nationalities: string[];
  };
  fetchAlerts: () => Promise<void>;
  fetchAlertDetails: (alertId: string, rule_id: string) => Promise<void>;
  disposeAlert: (disposition: AlertDisposition) => Promise<boolean>;
  updateFilters: (newFilters: Partial<AlertFilters>) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refreshAlerts: () => Promise<void>;
  fetchFilterOptions: () => Promise<void>;
}

const defaultFilters: AlertFilters = {
  search: '',
  service_type: [],
  rule_id: [],
  status: [],
  priority: [],
  date_range: {
    from: '',
    to: '',
  },
  assigned_to: [],
  branch_name: [],
  cust_nationality: [],
};

export const useAlerts = (initialPageSize: number = 20): UseAlertsReturn => {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalOpenAlerts, setTotalOpenAlerts] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);
  const [totalHighPriorityAlerts, setTotalHighPriorityAlerts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters);
  const [errorNotificationShown, setErrorNotificationShown] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    serviceTypes: [],
    ruleIds: [],
    statuses: [],
    priorities: [],
    assignees: [],
    branches: [],
    nationalities: [],
  });

  const { addNotification } = useNotifications();

  const buildQueryParams = useCallback(() => {
    const queryParams = new URLSearchParams();

    // Pagination parameters (always required)
    queryParams.append('page', currentPage.toString());
    queryParams.append('page_size', pageSize.toString());

    // Search filter
    if (filters.search && filters.search.trim()) {
      queryParams.append('search', filters.search.trim());
    }

    // Service type filter (multiple values)
    if (filters.service_type && filters.service_type.length > 0) {
      filters.service_type.forEach((type) => {
        queryParams.append('service_type', type);
      });
    }

    // Rule ID filter (multiple values)
    if (filters.rule_id && filters.rule_id.length > 0) {
      filters.rule_id.forEach((id) => {
        queryParams.append('rule_id', id);
      });
    }

    // Status filter (multiple values)
    if (filters.status && filters.status.length > 0) {
      filters.status.forEach((status) => {
        queryParams.append('status', status);
      });
    }

    // Priority filter (multiple values)
    if (filters.priority && filters.priority.length > 0) {
      filters.priority.forEach((priority) => {
        queryParams.append('rule_priority', priority);
      });
    }

    // Date range filters
    if (filters.date_range?.from && filters.date_range.from.trim()) {
      queryParams.append('from_date', filters.date_range.from.trim());
    }

    if (filters.date_range?.to && filters.date_range.to.trim()) {
      queryParams.append('to_date', filters.date_range.to.trim());
    }

    // Assigned to filter (multiple values)
    if (filters.assigned_to && filters.assigned_to.length > 0) {
      filters.assigned_to.forEach((assignee) => {
        queryParams.append('assigned_to', assignee);
      });
    }

    // Branch name filter (multiple values)
    if (filters.branch_name && filters.branch_name.length > 0) {
      filters.branch_name.forEach((branch) => {
        queryParams.append('branch_name', branch);
      });
    }

    // Customer nationality filter (multiple values)
    if (filters.cust_nationality && filters.cust_nationality.length > 0) {
      filters.cust_nationality.forEach((nationality) => {
        queryParams.append('cust_nationality', nationality);
      });
    }

    return queryParams.toString();
  }, [currentPage, pageSize, filters]);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorNotificationShown(false);

      const queryString = buildQueryParams();
      const apiUrl = `${config.api.baseUrl}/open-alerts-summary${
        queryString ? `?${queryString}` : ''
      }`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: AlertsResponse = await response.json();

      // Handle empty data array
      if (!data.data || data.data.length === 0) {
        setAlerts([]);
        setTotalCount(data.total || 0);
        setTotalPages(data.total_pages || 0);
        setTotalOpenAlerts(data.total_open_alerts || 0);
        setPendingReview(data.pending_review_count || 0);
        setTotalHighPriorityAlerts(data.total_high_priority_alerts || 0);
        setHasNext(data.has_next || false);
        setHasPrev(data.has_prev || false);
        setCurrentPage(data.current_page || 1);
        return;
      }

      // Deduplicate data based on alert_id (in case API returns duplicates)
      const uniqueAlertsMap = new Map<string, AlertSummary>();
      data.data.forEach((alert) => {
        if (!uniqueAlertsMap.has(alert.alert_id)) {
          uniqueAlertsMap.set(alert.alert_id, alert);
        }
      });

      const uniqueAlerts = Array.from(uniqueAlertsMap.values());

      // Update state with paginated response data
      setAlerts(uniqueAlerts);
      setTotalCount(data.total);
      setTotalPages(data.total_pages);
      setTotalOpenAlerts(data.total_open_alerts);
      setPendingReview(data.pending_review_count);
      setTotalHighPriorityAlerts(data.total_high_priority_alerts);
      setHasNext(data.has_next);
      setHasPrev(data.has_prev);
      setCurrentPage(data.current_page);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(errorMessage);

      // Only show notification once per error state
      if (!errorNotificationShown) {
        addNotification('Failed to load alerts', 'error');
        setErrorNotificationShown(true);
      }

      console.error('Error fetching alerts:', err);

      // Reset state on error
      setAlerts([]);
      setTotalCount(0);
      setTotalPages(0);
      setTotalOpenAlerts(0);
      setPendingReview(0);
      setTotalHighPriorityAlerts(0);
      setHasNext(false);
      setHasPrev(false);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, addNotification, errorNotificationShown]);

  const fetchAlertDetails = useCallback(
    async (alertId: string, ruleId: string) => {
      try {
        setLoading(true);
        setError(null);
        setErrorNotificationShown(false);

        const response = await fetch(
          `${config.api.baseUrl}/open-alerts-details`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ alert_id: alertId, rule_id: ruleId }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData: AlertDetailsResponse = await response.json();
        setSelectedAlert(responseData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch alert details';
        setError(errorMessage);

        // Only show notification once per error state
        if (!errorNotificationShown) {
          addNotification('Failed to load alert details', 'error');
          setErrorNotificationShown(true);
        }
        console.error('Error fetching alert details:', err);
        setSelectedAlert(null);
      } finally {
        setLoading(false);
      }
    },
    [addNotification, errorNotificationShown]
  );

  const disposeAlert = useCallback(
    async (disposition: AlertDisposition): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        setErrorNotificationShown(false);
        console.log('Disposing alert with disposition:', disposition);
        // In production, this would call the actual API
        const response = await apiClient.post(
          '/admin/alerts/update-status',
          disposition
        );

        if (response.success) {
          addNotification('Alert disposed successfully', 'success');
          await fetchAlerts(); // Refresh the alerts list
          return true;
        } else {
          throw new Error(response.error || 'Failed to dispose alert');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to dispose alert';
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
    },
    [addNotification, fetchAlerts, errorNotificationShown]
  );

  const updateFilters = useCallback((newFilters: Partial<AlertFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const setPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  const refreshAlerts = useCallback(async () => {
    await fetchAlerts();
  }, [fetchAlerts]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const filterOptions = await FilterOptionsAPI.getAllFilterOptions();
      setFilterOptions(filterOptions);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  }, []);
  // Fetch alerts when dependencies change
  useEffect(() => {
    fetchAlerts();
    fetchFilterOptions();
  }, [fetchAlerts, fetchFilterOptions]);

  return {
    alerts,
    selectedAlert,
    loading,
    error,
    totalCount,
    totalOpenAlerts,
    pendingReview,
    totalHighPriorityAlerts,
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    pageSize,
    filters,
    filterOptions,
    fetchAlerts,
    fetchAlertDetails,
    disposeAlert,
    updateFilters,
    setPage,
    setPageSize: handleSetPageSize,
    refreshAlerts,
    fetchFilterOptions,
  };
};
