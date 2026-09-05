import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { APP_CONSTANTS } from '../constants/app.constants';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  success(message: string, duration = APP_CONSTANTS.snackbarDuration): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = APP_CONSTANTS.snackbarDuration): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = APP_CONSTANTS.snackbarDuration): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = APP_CONSTANTS.snackbarDuration): void {
    this.show(message, 'info', duration);
  }

  private show(message: string, type: NotificationType, duration: number): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`],
    });
  }
}
