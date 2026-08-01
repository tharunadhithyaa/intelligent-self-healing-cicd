import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An unexpected error occurred.';

      if (error.error?.message) {
        message = error.error.message;
      } else {
        switch (error.status) {
          case 0:
            message = 'Unable to connect to the server. Please check your connection.';
            break;
          case 400:
            message = error.error?.errors?.join(', ') || 'Invalid request.';
            break;
          case 403:
            message = 'You do not have permission to perform this action.';
            break;
          case 404:
            message = 'The requested resource was not found.';
            break;
          case 409:
            message = 'A conflict occurred. The resource may already exist.';
            break;
          case 429:
            message = 'Too many requests. Please try again later.';
            break;
          case 500:
            message = 'Server error. Please try again later.';
            break;
        }
      }

      // Don't show notification for 401 (handled by auth interceptor)
      if (error.status !== 401) {
        notification.error(message);
      }

      return throwError(() => error);
    }),
  );
};
