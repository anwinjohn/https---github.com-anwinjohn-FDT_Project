// Mock API endpoints for filter options
// In a real application, these would be actual API calls to your backend

import config from '../config/app-config.json';

interface FilterOptionResponse {
  options: string[];
  total: number;
}

// Mock data for demonstration
const mockFilterData = {
  serviceTypes: ['OUTWARD', 'INWARD', 'INTERNAL', 'SWIFT', 'ACH'],
  ruleIds: ['RF-001', 'RF-003', 'RF-005', 'RF-007', 'RF-012', 'RF-015', 'RF-020', 'RF-025'],
  priorities: ['High', 'Medium', 'Low'],
  statuses: ['OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'ESCALATED'],
  assignees: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'Unassigned'],
  branches: ['Main Branch', 'Downtown', 'Uptown', 'East Side', 'West Side', 'North Branch'],
  nationalities: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX']
};

class FilterOptionsAPI {
  private static baseUrl = config.api.baseUrl;

  static async getServiceTypes(): Promise<FilterOptionResponse> {
    try {
      // In production, this would be a real API call
      // const response = await fetch(`${this.baseUrl}/filter-options/service-types`);
      // return await response.json();
      
      // Mock response for now
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.serviceTypes,
            total: mockFilterData.serviceTypes.length
          });
        }, 100);
      });
    } catch (error) {
      console.error('Error fetching service types:', error);
      return { options: mockFilterData.serviceTypes, total: mockFilterData.serviceTypes.length };
    }
  }

  static async getRuleIds(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.ruleIds,
            total: mockFilterData.ruleIds.length
          });
        }, 150);
      });
    } catch (error) {
      console.error('Error fetching rule IDs:', error);
      return { options: mockFilterData.ruleIds, total: mockFilterData.ruleIds.length };
    }
  }

  static async getPriorities(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.priorities,
            total: mockFilterData.priorities.length
          });
        }, 80);
      });
    } catch (error) {
      console.error('Error fetching priorities:', error);
      return { options: mockFilterData.priorities, total: mockFilterData.priorities.length };
    }
  }

  static async getStatuses(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.statuses,
            total: mockFilterData.statuses.length
          });
        }, 120);
      });
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return { options: mockFilterData.statuses, total: mockFilterData.statuses.length };
    }
  }

  static async getAssignees(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.assignees,
            total: mockFilterData.assignees.length
          });
        }, 200);
      });
    } catch (error) {
      console.error('Error fetching assignees:', error);
      return { options: mockFilterData.assignees, total: mockFilterData.assignees.length };
    }
  }

  static async getBranches(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.branches,
            total: mockFilterData.branches.length
          });
        }, 180);
      });
    } catch (error) {
      console.error('Error fetching branches:', error);
      return { options: mockFilterData.branches, total: mockFilterData.branches.length };
    }
  }

  static async getNationalities(): Promise<FilterOptionResponse> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            options: mockFilterData.nationalities,
            total: mockFilterData.nationalities.length
          });
        }, 160);
      });
    } catch (error) {
      console.error('Error fetching nationalities:', error);
      return { options: mockFilterData.nationalities, total: mockFilterData.nationalities.length };
    }
  }

  // Batch fetch all filter options
  static async getAllFilterOptions() {
    try {
      const [
        serviceTypes,
        ruleIds,
        priorities,
        statuses,
        assignees,
        branches,
        nationalities
      ] = await Promise.all([
        this.getServiceTypes(),
        this.getRuleIds(),
        this.getPriorities(),
        this.getStatuses(),
        this.getAssignees(),
        this.getBranches(),
        this.getNationalities()
      ]);

      return {
        serviceTypes: serviceTypes.options,
        ruleIds: ruleIds.options,
        priorities: priorities.options,
        statuses: statuses.options,
        assignees: assignees.options,
        branches: branches.options,
        nationalities: nationalities.options
      };
    } catch (error) {
      console.error('Error fetching all filter options:', error);
      return {
        serviceTypes: mockFilterData.serviceTypes,
        ruleIds: mockFilterData.ruleIds,
        priorities: mockFilterData.priorities,
        statuses: mockFilterData.statuses,
        assignees: mockFilterData.assignees,
        branches: mockFilterData.branches,
        nationalities: mockFilterData.nationalities
      };
    }
  }
}

export default FilterOptionsAPI;