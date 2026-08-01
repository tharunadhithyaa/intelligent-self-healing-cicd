import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs/operators';

export interface UserNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/notifications`;

  readonly notifications = signal<UserNotification[]>([]);
  readonly unreadCount = signal<number>(0);

  constructor() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.http
      .get<{ success: boolean; data: { notifications: UserNotification[] } }>(this.API_URL)
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.notifications) {
            this.notifications.set(res.data.notifications);
            this.updateUnreadCount(res.data.notifications);
          }
        },
        error: (err) => console.error('Failed to load notifications', err),
      });
  }

  markAsRead(id: string) {
    return this.http.put(`${this.API_URL}/${id}/read`, {}).pipe(
      tap(() => {
        const current = this.notifications().map((n) =>
          n._id === id ? { ...n, isRead: true } : n,
        );
        this.notifications.set(current);
        this.updateUnreadCount(current);
      }),
    );
  }

  markAllAsRead() {
    return this.http.put(`${this.API_URL}/read-all`, {}).pipe(
      tap(() => {
        const current = this.notifications().map((n) => ({ ...n, isRead: true }));
        this.notifications.set(current);
        this.updateUnreadCount(current);
      }),
    );
  }

  deleteNotification(id: string) {
    return this.http.delete(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        const current = this.notifications().filter((n) => n._id !== id);
        this.notifications.set(current);
        this.updateUnreadCount(current);
      }),
    );
  }

  private updateUnreadCount(notifications: UserNotification[]) {
    this.unreadCount.set(notifications.filter((n) => !n.isRead).length);
  }
}
