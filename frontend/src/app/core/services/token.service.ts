import { Injectable, signal } from '@angular/core';
import { APP_CONSTANTS } from '../constants/app.constants';
import { AuthTokens } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly isRemembered = signal<boolean>(this.getRememberMe());

  getAccessToken(): string | null {
    return this.getStorage().getItem(APP_CONSTANTS.tokenKey);
  }

  getRefreshToken(): string | null {
    return this.getStorage().getItem(APP_CONSTANTS.refreshTokenKey);
  }

  setTokens(tokens: AuthTokens, rememberMe = false): void {
    this.setRememberMe(rememberMe);
    const storage = this.getStorage();
    storage.setItem(APP_CONSTANTS.tokenKey, tokens.accessToken);
    storage.setItem(APP_CONSTANTS.refreshTokenKey, tokens.refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(APP_CONSTANTS.tokenKey);
    localStorage.removeItem(APP_CONSTANTS.refreshTokenKey);
    localStorage.removeItem(APP_CONSTANTS.userKey);
    sessionStorage.removeItem(APP_CONSTANTS.tokenKey);
    sessionStorage.removeItem(APP_CONSTANTS.refreshTokenKey);
    sessionStorage.removeItem(APP_CONSTANTS.userKey);
    localStorage.removeItem(APP_CONSTANTS.rememberMeKey);
    this.isRemembered.set(false);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  setRememberMe(value: boolean): void {
    localStorage.setItem(APP_CONSTANTS.rememberMeKey, String(value));
    this.isRemembered.set(value);
  }

  private getRememberMe(): boolean {
    return localStorage.getItem(APP_CONSTANTS.rememberMeKey) === 'true';
  }

  private getStorage(): Storage {
    return this.isRemembered() ? localStorage : sessionStorage;
  }
}
