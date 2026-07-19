import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-topbar',
  imports: [MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatBadgeModule, AvatarComponent, RouterLink],
  template: `
    <header class="topbar" role="banner">
      <div class="topbar__left">
        <button
          class="topbar__menu-btn"
          mat-icon-button
          (click)="menuToggle.emit()"
          aria-label="Toggle navigation menu"
        >
          <mat-icon>menu</mat-icon>
        </button>
      </div>

      <div class="topbar__right">
        <!-- Notifications -->
        <button
          mat-icon-button
          class="topbar__icon-btn"
          matBadge="3"
          matBadgeColor="warn"
          matBadgeSize="small"
          aria-label="Notifications"
          routerLink="/notifications"
        >
          <mat-icon>notifications_none</mat-icon>
        </button>

        <!-- User Menu -->
        <button
          class="topbar__user-btn"
          [matMenuTriggerFor]="userMenu"
          aria-label="User menu"
        >
          <app-avatar
            [name]="authService.userFullName()"
            [size]="36"
          />
          <div class="topbar__user-info">
            <span class="topbar__user-name">{{ authService.userFullName() }}</span>
            <span class="topbar__user-role">{{ authService.userRole() }}</span>
          </div>
          <mat-icon class="topbar__chevron">expand_more</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="topbar__menu-header">
            <app-avatar [name]="authService.userFullName()" [size]="44" />
            <div>
              <div class="topbar__menu-name">{{ authService.userFullName() }}</div>
              <div class="topbar__menu-email">{{ authService.user()?.email }}</div>
            </div>
          </div>

          <mat-divider></mat-divider>

          <button mat-menu-item routerLink="/profile">
            <mat-icon>person_outline</mat-icon>
            <span>My Profile</span>
          </button>

          <button mat-menu-item routerLink="/settings">
            <mat-icon>settings</mat-icon>
            <span>Settings</span>
          </button>

          <button mat-menu-item routerLink="/notifications">
            <mat-icon>notifications_none</mat-icon>
            <span>Notifications</span>
          </button>

          <mat-divider></mat-divider>

          <button mat-menu-item routerLink="/help">
            <mat-icon>help_outline</mat-icon>
            <span>Help & Support</span>
          </button>

          <button mat-menu-item routerLink="/about">
            <mat-icon>info_outline</mat-icon>
            <span>About CivicPulse AI</span>
          </button>

          <mat-divider></mat-divider>

          <button mat-menu-item (click)="authService.logout()">
            <mat-icon>logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .topbar {
      @include flex-between;
      height: $topbar-height;
      padding: 0 $spacing-4;
      background: $surface;
      border-bottom: 1px solid $border;
      position: sticky;
      top: 0;
      z-index: $z-sticky;

      @include md {
        padding: 0 $spacing-6;
      }

      &__left {
        @include flex-start;
        gap: $spacing-3;
      }

      &__menu-btn {
        @include desktop-only {
          display: none;
        }
      }

      &__right {
        @include flex-start;
        gap: $spacing-2;
      }

      &__icon-btn {
        color: $icon-secondary;

        &:hover {
          color: $text-primary;
        }
      }

      &__user-btn {
        @include flex-start;
        gap: $spacing-3;
        padding: $spacing-2 $spacing-3;
        border-radius: $radius-lg;
        cursor: pointer;
        background: none;
        border: none;
        transition: background $transition-fast;

        &:hover {
          background: $background;
        }
      }

      &__user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;

        @include mobile-only {
          display: none;
        }
      }

      &__user-name {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $text-primary;
        @include text-truncate;
        max-width: 150px;
      }

      &__user-role {
        font-size: $font-size-xs;
        color: $text-muted;
        text-transform: capitalize;
      }

      &__chevron {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: $text-muted;

        @include mobile-only {
          display: none;
        }
      }
    }

    // Menu Header
    .topbar__menu-header {
      display: flex;
      align-items: center;
      gap: $spacing-3;
      padding: $spacing-3 $spacing-4;
    }

    .topbar__menu-name {
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      color: $text-primary;
    }

    .topbar__menu-email {
      font-size: $font-size-xs;
      color: $text-muted;
    }
  `],
})
export class TopbarComponent {
  readonly menuToggle = output<void>();

  constructor(readonly authService: AuthService) {}
}
