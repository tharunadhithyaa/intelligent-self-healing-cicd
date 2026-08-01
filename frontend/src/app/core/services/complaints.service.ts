import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import { Complaint, AIAnalysis } from '../models/complaint.model';

export interface SubmitComplaintRequest {
  title: string;
  description: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images: Array<{
    base64Data: string;
    contentType: string;
    fileName: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ComplaintsService {
  constructor(private readonly http: HttpClient) {}

  getComplaints(): Observable<ApiResponse<{ complaints: Complaint[] }>> {
    return this.http.get<ApiResponse<{ complaints: Complaint[] }>>(API_ENDPOINTS.complaints.base);
  }

  getComplaintById(id: string): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.get<ApiResponse<{ complaint: Complaint }>>(
      API_ENDPOINTS.complaints.details(id),
    );
  }

  submitComplaint(data: SubmitComplaintRequest): Observable<ApiResponse<{ complaint: Complaint }>> {
    return this.http.post<ApiResponse<{ complaint: Complaint }>>(
      API_ENDPOINTS.complaints.base,
      data,
    );
  }

  analyzeDraft(data: {
    title: string;
    description: string;
    location: { latitude: number; longitude: number; address: string };
  }): Observable<ApiResponse<{ analysis: AIAnalysis }>> {
    return this.http.post<ApiResponse<{ analysis: AIAnalysis }>>(
      API_ENDPOINTS.complaints.analyze,
      data,
    );
  }
}
