/**
 * User management API surface.
 *
 * Endpoints for the backend team to implement:
 *  GET    {base}/admin/users/:id/details         -> profile + security info for the details drawer
 *  PUT    {base}/admin/users/:id                 -> edit profile { full_name, email_id }
 *  POST   {base}/admin/users/update/status       -> { user_id, new_status: 'Active' | 'Inactive' } (already exists)
 *  POST   {base}/admin/users/:id/lock            -> lock account
 *  POST   {base}/admin/users/:id/unlock          -> unlock account
 *  POST   {base}/admin/users/:id/reset-password  -> email a password reset link
 *  DELETE {base}/admin/users/:id                 -> remove the user
 *  PUT    {base}/admin/users/:id/sensitive-data  -> { can_view_sensitive: boolean }
 */
import apiClient from '../utils/apiClient';
import type { LocalMachineInfo } from '../utils/machineInfoStore';

export interface UserDetailsPayload {
  id: string;
  username: string;
  email_id: string;
  full_name: string;
  user_roles: string;
  account_status: string;
  user_status: string;
  active_flag: boolean;
  account_locked: boolean;
  account_locked_until?: string | null;
  login_attempts?: number;
  mfa_enabled: boolean;
  email_verified: boolean;
  can_view_sensitive?: boolean;
  last_login?: string | null;
  last_password_change?: string | null;
  created_at: string;
  updated_at: string;
}

export const getUserDetails = async (userId: string) =>
  (await apiClient.get(`/admin/users/${userId}/details`)).data;

export const updateUser = async (
  userId: string,
  payload: { full_name: string; email_id: string }
) => (await apiClient.put(`/admin/users/${userId}`, payload)).data;

export const setUserStatus = async (
  userId: string,
  newStatus: 'Active' | 'Inactive',
  updatedBy: string,
  machineInfo?: LocalMachineInfo
) =>
  (
    await apiClient.post('/admin/users/update/status', {
      user_id: userId,
      new_status: newStatus,
      updated_by: updatedBy,
      machine_info: machineInfo ?? null,
    })
  ).data;

export const lockUser = async (userId: string) =>
  (await apiClient.post(`/admin/users/${userId}/lock`)).data;

export const unlockUser = async (userId: string) =>
  (await apiClient.post(`/admin/users/${userId}/unlock`)).data;

export const resetUserPassword = async (userId: string) =>
  (await apiClient.post(`/admin/users/${userId}/reset-password`)).data;

export const deleteUser = async (userId: string) =>
  (await apiClient.delete(`/admin/users/${userId}`)).data;

export const setSensitiveDataAccess = async (
  userId: string,
  canViewSensitive: boolean
) =>
  (
    await apiClient.put(`/admin/users/${userId}/sensitive-data`, {
      can_view_sensitive: canViewSensitive,
    })
  ).data;
