import { format, parse, addDays, isValid } from 'date-fns';
import { appConfig as config } from '../config/runtime-config';

// Format date to YYYY-MM-DD
export const formatDateForApi = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Format date to display format
export const formatDateForDisplay = (date: Date): string => {
  return format(date, 'MMM dd, yyyy');
};

// Parse string date from API
export const parseApiDate = (dateString: string): Date => {
  const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(parsedDate) ? parsedDate : new Date();
};

// Get today's date
export const getTodayDate = (): Date => {
  return new Date();
};

// Get date from N days ago
export const getDateDaysAgo = (days: number): Date => {
  return addDays(new Date(), -days);
};

// Get default date range (today)
export const getDefaultDateRange = () => {
  const today = getTodayDate();
  const days = config.dashboard.defaultDateRange?.days ?? 7;
  // console.log('Datexx : ', config.dashboard.defaultDateRange?.days);
  const fromDate = getDateDaysAgo(days);
  return {
    fromDate: formatDateForApi(fromDate),
    toDate: formatDateForApi(today),
  };
};
