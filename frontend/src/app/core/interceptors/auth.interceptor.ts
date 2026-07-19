import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, filter, take, throwError } from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  // Skip auth header for auth endpoints (except /me)
  const isAuthEndpoint = req.url.includes('/auth/') && !req.url.includes('/auth/me');
  const token = tokenService.getAccessToken();

  let authReq = req;
  if (token && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        return handleTokenRefresh(authService, tokenService, req, next);
      }
      return throwError(() => error);
    })
  );
};

function handleTokenRefresh(
  authService: AuthService,
  tokenService: TokenService,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) {
  const isRefreshing = authService.getRefreshingState();

  if (!isRefreshing.value) {
    isRefreshing.next(true);

    return authService.refreshToken().pipe(
      switchMap(() => {
        isRefreshing.next(false);
        const token = tokenService.getAccessToken();
        const cloned = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
        return next(cloned);
      }),
      catchError((err) => {
        isRefreshing.next(false);
        authService.logout();
        return throwError(() => err);
      })
    );
  }

  // Wait for the ongoing refresh to complete, then retry
  return isRefreshing.pipe(
    filter((refreshing) => !refreshing),
    take(1),
    switchMap(() => {
      const token = tokenService.getAccessToken();
      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(cloned);
    })
  );
}
