export interface UserOnboardingData {
  id: string;
  username: string;
  email_id: string;
  salt_value: string | null;
  full_name: string;
  active_flag: boolean;
  role_id: number;
  login_attempts: number;
  account_locked: boolean;
  account_locked_until: string | null;
  last_login: string | null;
  last_password_change: string | null;
  avtar_url: string | null;
  mfa_enabled: boolean;
  email_verified: boolean;
  account_status: string;
  user_status: string;
  user_roles: string;
  created_at: string;
  updated_at: string;
}

export interface UserOnboardingResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  current_page: number;
  data: UserOnboardingData[];
}

export interface UserOnboardingFilters {
  search: string;
  account_status: string;
  user_status: string;
  user_roles: string;
}

export interface UserOnboardingPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next?: boolean;
  has_prev?: boolean;
  current_page?: number;
}
