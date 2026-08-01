import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserNotificationsService } from '../../../../core/services/user-notifications.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, PageHeaderComponent],
  template: `
    <div class="notifications-page animate-fade-in-up">
      <app-page-header
        title="Notifications"
        subtitle="View all your recent alerts, updates, and announcements."
        icon="notifications"
      >
        <button
          mat-stroked-button
          color="primary"
          (click)="notificationsService.markAllAsRead()"
          [disabled]="notificationsService.unreadCount() === 0"
        >
          <mat-icon>done_all</mat-icon> Mark All Read
        </button>
      </app-page-header>

      <div class="notifications-list">
        @if (notificationsService.notifications().length === 0) {
          <div class="empty-state">
            <mat-icon>notifications_none</mat-icon>
            <h3>No Notifications</h3>
            <p>You're all caught up! There are no new notifications to display.</p>
          </div>
        }

        @for (notif of notificationsService.notifications(); track notif._id) {
          <div class="notification-item" [class.unread]="!notif.isRead">
            <div class="notification-icon" [ngClass]="notif.type">
              <mat-icon>{{ getIconForType(notif.type) }}</mat-icon>
            </div>
            <div class="notification-content">
              <h4>{{ notif.title }}</h4>
              <p>{{ notif.message }}</p>
              <span class="time">{{ notif.createdAt | date: 'medium' }}</span>
            </div>
            <div class="notification-actions">
              @if (!notif.isRead) {
                <button
                  mat-icon-button
                  color="primary"
                  (click)="notificationsService.markAsRead(notif._id)"
                  title="Mark as Read"
                >
                  <mat-icon>check_circle</mat-icon>
                </button>
              }
              <button
                mat-icon-button
                color="warn"
                (click)="notificationsService.deleteNotification(notif._id)"
                title="Delete Notification"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .notifications-page {
        display: flex;
        flex-direction: column;
      }

      .notifications-list {
        display: flex;
        flex-direction: column;
        gap: $spacing-4;
        margin-top: $spacing-6;
      }

      .notification-item {
        @include card-base;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: $spacing-4;
        gap: $spacing-4;
        border: 1px solid $border-light;
        transition: all $transition-fast;

        &:hover {
          border-color: $border;
          background: $surface;
        }

        &.unread {
          border-left: 4px solid $primary;
          background: $primary-light;
        }
      }

      .notification-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: $background;
        color: $text-secondary;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        &.system_alert {
          color: $danger;
          background: rgba(220, 38, 38, 0.1);
        }
        &.status_update {
          color: $primary;
          background: rgba(22, 163, 74, 0.1);
        }
        &.announcement {
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
        }
      }

      .notification-content {
        flex: 1;

        h4 {
          margin: 0 0 $spacing-1 0;
          font-size: $font-size-base;
          color: $text-primary;
          font-weight: $font-weight-semibold;
        }

        p {
          margin: 0 0 $spacing-2 0;
          font-size: $font-size-sm;
          color: $text-secondary;
          line-height: $line-height-normal;
        }

        .time {
          font-size: $font-size-xs;
          color: $text-muted;
        }
      }

      .notification-actions {
        display: flex;
        flex-direction: column;
        gap: $spacing-2;

        @include md {
          flex-direction: row;
        }
      }

      .empty-state {
        @include flex-center;
        flex-direction: column;
        padding: $spacing-12 $spacing-6;
        text-align: center;
        background: $surface;
        border-radius: $radius-lg;
        border: 1px dashed $border;

        mat-icon {
          font-size: 64px;
          width: 64px;
          height: 64px;
          color: $icon-secondary;
          margin-bottom: $spacing-4;
        }

        h3 {
          margin: 0 0 $spacing-2 0;
          font-size: $font-size-lg;
          color: $text-primary;
        }

        p {
          margin: 0;
          color: $text-secondary;
          max-width: 400px;
        }
      }
    `,
  ],
})
export class NotificationsComponent {
  readonly notificationsService = inject(UserNotificationsService);

  getIconForType(type: string): string {
    switch (type) {
      case 'system_alert':
        return 'warning';
      case 'status_update':
        return 'info';
      case 'announcement':
        return 'campaign';
      default:
        return 'notifications';
    }
  }
}
