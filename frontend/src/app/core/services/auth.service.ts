import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, BehaviorSubject } from 'rxjs';
import { TokenService } from './token.service';
import { NotificationService } from '@services/notification.service';
import { API_ENDPOINTS } from '@constants/api.constants';
import { ROUTE_PATHS } from '@constants/route.constants';
import { APP_CONSTANTS } from '@constants/app.constants';
import { User } from '@models/user.model';
import {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthResponse,
  RefreshTokenRequest,
  AuthTokens,
} from '../models/auth.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUser = signal<User | null>(this.loadStoredUser());
  private readonly isRefreshing = new BehaviorSubject<boolean>(false);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role ?? null);
  readonly userFullName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });
  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    const first = user.firstName ? user.firstName.charAt(0) : '';
    const last = user.lastName ? user.lastName.charAt(0) : '';
    return `${first}${last}`.toUpperCase() || '?';
  });

  constructor(
    private readonly http: HttpClient,
    private readonly tokenService: TokenService,
    private readonly notification: NotificationService,
    private readonly router: Router
  ) { }

  login(data: LoginRequest, rememberMe = false): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.login, data).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data, rememberMe);
        }
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  register(data: RegisterRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(API_ENDPOINTS.auth.register, data).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data, false);
        }
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(API_ENDPOINTS.auth.forgotPassword, data);
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(API_ENDPOINTS.auth.resetPassword, data);
  }

  refreshToken(): Observable<ApiResponse<{ tokens: AuthTokens }>> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    const body: RefreshTokenRequest = { refreshToken };
    return this.http
      .post<ApiResponse<{ tokens: AuthTokens }>>(API_ENDPOINTS.auth.refreshToken, body)
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.tokenService.setTokens(response.data.tokens);
          }
        }),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        })
      );
  }

  getMe(): Observable<ApiResponse<{ user: User }>> {
    return this.http.get<ApiResponse<{ user: User }>>(API_ENDPOINTS.auth.me).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.currentUser.set(response.data.user);
          this.storeUser(response.data.user);
        }
      })
    );
  }

  logout(): void {
    const refreshToken = this.tokenService.getRefreshToken();
    if (refreshToken) {
      this.http
        .post(API_ENDPOINTS.auth.logout, { refreshToken })
        .subscribe({ error: () => { } });
    }

    this.tokenService.clearTokens();
    this.currentUser.set(null);
    this.router.navigate(['/', ROUTE_PATHS.auth.root, ROUTE_PATHS.auth.login]);
  }

  getRefreshingState(): BehaviorSubject<boolean> {
    return this.isRefreshing;
  }

  private handleAuthSuccess(data: AuthResponse, rememberMe: boolean): void {
    this.tokenService.setTokens(data.tokens, rememberMe);
    this.currentUser.set(data.user);
    this.storeUser(data.user);
  }

  private storeUser(user: User): void {
    try {
      const storage = localStorage.getItem(APP_CONSTANTS.rememberMeKey) === 'true'
        ? localStorage
        : sessionStorage;
      storage.setItem(APP_CONSTANTS.userKey, JSON.stringify(user));
    } catch (e) {
      console.warn('Unable to write user data to browser storage:', e);
    }
  }

  private loadStoredUser(): User | null {
    try {
      const stored = localStorage.getItem(APP_CONSTANTS.userKey)
        || sessionStorage.getItem(APP_CONSTANTS.userKey);
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch (e) {
      console.warn('Unable to read user data from browser storage:', e);
    }
    return null;
  }
}
