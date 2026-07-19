import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { Complaint } from '../models/complaint.model';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FieldWorkerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/field-worker`;

  getAssignedJobs(params: Record<string, any>): Observable<ApiResponse<{ jobs: Complaint[]; total: number; page: number; limit: number }>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return this.http.get<ApiResponse<{ jobs: Complaint[]; total: number; page: number; limit: number }>>(`${this.baseUrl}/jobs`, { params: httpParams });
  }

  getJobDetails(id: string): Observable<ApiResponse<{ job: Complaint }>> {
    return this.http.get<ApiResponse<{ job: Complaint }>>(`${this.baseUrl}/jobs/${id}`);
  }

  updateJobStatus(id: string, status: string, notes?: string): Observable<ApiResponse<{ job: Complaint }>> {
    return this.http.put<ApiResponse<{ job: Complaint }>>(`${this.baseUrl}/jobs/${id}/status`, { status, notes });
  }

  uploadPhotos(id: string, photoType: 'before' | 'after', images: Array<{ base64Data: string; contentType: string; fileName: string }>): Observable<ApiResponse<{ job: Complaint }>> {
    return this.http.post<ApiResponse<{ job: Complaint }>>(`${this.baseUrl}/jobs/${id}/photos`, { photoType, images });
  }
}
