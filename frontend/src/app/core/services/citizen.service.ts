import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import { User } from '../models/user.model';

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  bio?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesRequest {
  email: boolean;
  statusUpdates: boolean;
  alerts: boolean;
}

@Injectable({ providedIn: 'root' })
export class CitizenService {
  constructor(private readonly http: HttpClient) {}

  updateProfile(data: UpdateProfileRequest): Observable<ApiResponse<{ user: User }>> {
    return this.http.put<ApiResponse<{ user: User }>>(API_ENDPOINTS.citizen.profile, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(API_ENDPOINTS.citizen.security, data);
  }

  updatePreferences(data: UpdatePreferencesRequest): Observable<ApiResponse<{ user: User }>> {
    return this.http.put<ApiResponse<{ user: User }>>(API_ENDPOINTS.citizen.preferences, data);
  }
}
