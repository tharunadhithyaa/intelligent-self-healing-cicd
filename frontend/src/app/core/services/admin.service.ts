import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import { User } from '../models/user.model';
import {
  OverviewStats,
  MonthlyTrend,
  AIAccuracyMetrics,
  HeatmapItem,
  Department,
  AuditLog,
  AdminReportData,
} from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  // ─── Dashboard Overview ───
  getOverviewStats(): Observable<ApiResponse<{ stats: OverviewStats }>> {
    return this.http.get<ApiResponse<{ stats: OverviewStats }>>(API_ENDPOINTS.admin.overview);
  }

  getAnalyticsOverview(): Observable<
    ApiResponse<{
      analytics: {
        trends: MonthlyTrend[];
        aiMetrics: AIAccuracyMetrics;
        heatmap: HeatmapItem[];
      };
    }>
  > {
    return this.http.get<
      ApiResponse<{
        analytics: {
          trends: MonthlyTrend[];
          aiMetrics: AIAccuracyMetrics;
          heatmap: HeatmapItem[];
        };
      }>
    >(API_ENDPOINTS.admin.analytics);
  }

  // ─── User Management ───
  getUsers(params: {
    search?: string;
    role?: string;
    isActive?: boolean;
    isLocked?: boolean;
    page?: number;
    limit?: number;
    sortField?: string;
    sortOrder?: string;
  }): Observable<ApiResponse<{ users: User[]; total: number }>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        httpParams = httpParams.set(key, String(val));
      }
    });

    return this.http.get<ApiResponse<{ users: User[]; total: number }>>(API_ENDPOINTS.admin.users, {
      params: httpParams,
    });
  }

  toggleUserStatus(id: string, isActive: boolean): Observable<ApiResponse<{ user: User }>> {
    return this.http.put<ApiResponse<{ user: User }>>(API_ENDPOINTS.admin.userStatus(id), {
      isActive,
    });
  }

  toggleUserLock(id: string, isLocked: boolean): Observable<ApiResponse<{ user: User }>> {
    return this.http.put<ApiResponse<{ user: User }>>(API_ENDPOINTS.admin.userLock(id), {
      isLocked,
    });
  }

  resetUserPassword(id: string): Observable<ApiResponse<{ defaultPassword: string }>> {
    return this.http.put<ApiResponse<{ defaultPassword: string }>>(
      API_ENDPOINTS.admin.userResetPassword(id),
      {},
    );
  }

  // ─── Department Management ───
  createDepartment(dept: {
    name: string;
    description: string;
    contactInfo: string;
  }): Observable<ApiResponse<{ department: Department }>> {
    return this.http.post<ApiResponse<{ department: Department }>>(
      API_ENDPOINTS.admin.departments,
      dept,
    );
  }

  getDepartments(): Observable<ApiResponse<{ departments: Department[] }>> {
    return this.http.get<ApiResponse<{ departments: Department[] }>>(
      API_ENDPOINTS.admin.departments,
    );
  }

  updateDepartment(
    id: string,
    dept: {
      name: string;
      description: string;
      contactInfo: string;
      status: 'active' | 'inactive';
    },
  ): Observable<ApiResponse<{ department: Department }>> {
    return this.http.put<ApiResponse<{ department: Department }>>(
      API_ENDPOINTS.admin.departmentDetails(id),
      dept,
    );
  }

  deleteDepartment(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(API_ENDPOINTS.admin.departmentDetails(id));
  }

  assignOfficer(
    deptId: string,
    officerId: string,
  ): Observable<ApiResponse<{ department: Department }>> {
    return this.http.post<ApiResponse<{ department: Department }>>(
      API_ENDPOINTS.admin.departmentAssign(deptId),
      { officerId },
    );
  }

  removeOfficer(
    deptId: string,
    officerId: string,
  ): Observable<ApiResponse<{ department: Department }>> {
    return this.http.post<ApiResponse<{ department: Department }>>(
      API_ENDPOINTS.admin.departmentRemove(deptId),
      { officerId },
    );
  }

  // ─── Reports & Export ───
  generateReport(
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ): Observable<ApiResponse<{ report: AdminReportData }>> {
    let httpParams = new HttpParams().set('timeframe', timeframe);
    return this.http.get<ApiResponse<{ report: AdminReportData }>>(API_ENDPOINTS.admin.reports, {
      params: httpParams,
    });
  }

  exportReportCSV(timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Observable<Blob> {
    let httpParams = new HttpParams().set('timeframe', timeframe);
    return this.http.get(API_ENDPOINTS.admin.export, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  // ─── Audit Logs ───
  getAuditLogs(params: {
    search?: string;
    action?: string;
    role?: string;
    target?: string;
    startDate?: string;
    endDate?: string;
    sortField?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<{ logs: AuditLog[]; total: number }>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        httpParams = httpParams.set(key, String(val));
      }
    });

    return this.http.get<ApiResponse<{ logs: AuditLog[]; total: number }>>(
      API_ENDPOINTS.admin.auditLogs,
      { params: httpParams },
    );
  }

  // ─── Central Notifications Broadcast ───
  broadcastNotification(payload: {
    targetRoles: string[];
    title: string;
    message: string;
  }): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(API_ENDPOINTS.admin.broadcast, payload);
  }
}
