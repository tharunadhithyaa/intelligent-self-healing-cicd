import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { Complaint } from '../models/complaint.model';

export interface OfficerStats {
  assigned: number;
  pending: number;
  highPriority: number;
  completed: number;
  averageResponseHours: number;
}

export interface DeptStats {
  total: number;
  performanceRate: number;
  workload: {
    submitted: number;
    inProgress: number;
    waiting: number;
    resolved: number;
  };
}

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OfficerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/officer`;

  getDashboardStats(): Observable<ApiResponse<{ stats: OfficerStats }>> {
    return this.http.get<ApiResponse<{ stats: OfficerStats }>>(`${this.baseUrl}/stats`);
  }

  getDepartmentStats(): Observable<ApiResponse<{ stats: DeptStats }>> {
    return this.http.get<ApiResponse<{ stats: DeptStats }>>(`${this.baseUrl}/dept-stats`);
  }

  getComplaints(
    params: Record<string, any>,
  ): Observable<
    ApiResponse<{ complaints: Complaint[]; total: number; page: number; limit: number }>
  > {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return this.http.get<
      ApiResponse<{ complaints: Complaint[]; total: number; page: number; limit: number }>
    >(`${this.baseUrl}/complaints`, { params: httpParams });
  }

  getComplaintDetails(id: string): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.get<ApiResponse<{ complaint: Complaint }>>(`${this.baseUrl}/complaints/${id}`);
  }

  transitionStatus(
    id: string,
    status: string,
    title?: string,
    description?: string,
  ): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.put<ApiResponse<{ complaint: Complaint }>>(
      `${this.baseUrl}/complaints/${id}/status`,
      { status, title, description },
    );
  }

  assignWorker(
    id: string,
    workerId: string,
    notes?: string,
  ): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.post<ApiResponse<{ complaint: Complaint }>>(
      `${this.baseUrl}/complaints/${id}/assign`,
      { workerId, notes },
    );
  }

  addInternalNote(id: string, text: string): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.post<ApiResponse<{ complaint: Complaint }>>(
      `${this.baseUrl}/complaints/${id}/notes`,
      { text },
    );
  }

  submitResolution(
    id: string,
    description: string,
    details?: string,
  ): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.post<ApiResponse<{ complaint: Complaint }>>(
      `${this.baseUrl}/complaints/${id}/resolution`,
      { description, details },
    );
  }

  getAvailableWorkers(): Observable<ApiResponse<{ workers: any[] }>> {
    return this.http.get<ApiResponse<{ workers: any[] }>>(`${this.baseUrl}/workers`);
  }
}
