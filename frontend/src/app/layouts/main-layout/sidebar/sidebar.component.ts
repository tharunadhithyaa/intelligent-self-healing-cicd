import { Component, input, output, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatTooltipModule, AvatarComponent],
  template: `
    <aside
      class="sidebar"
      [class.sidebar--open]="isOpen()"
      [class.sidebar--collapsed]="isCollapsed()"
      role="navigation"
      aria-label="Main navigation"
    >
      <!-- Brand -->
      <div class="sidebar__brand">
        <div class="sidebar__logo">
          <img src="logo.jpg" alt="Logo" style="width: 32px; height: 32px; border-radius: 8px;">
        </div>
        @if (!isCollapsed()) {
          <div class="sidebar__brand-text">
            <span class="sidebar__brand-name">CivicPulse</span>
            <span class="sidebar__brand-tagline">AI Assistant</span>
          </div>
        }
        <button
          class="sidebar__collapse-btn"
          mat-icon-button
          (click)="collapse.emit()"
          [matTooltip]="isCollapsed() ? 'Expand' : 'Collapse'"
          aria-label="Toggle sidebar"
        >
          <mat-icon>{{ isCollapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav">
        @for (item of navItems(); track item.route) {
          <a
            class="sidebar__nav-item"
            [routerLink]="item.route"
            routerLinkActive="sidebar__nav-item--active"
            [matTooltip]="isCollapsed() ? item.label : ''"
            matTooltipPosition="right"
            (click)="onNavClick()"
          >
            <mat-icon class="sidebar__nav-icon">{{ item.icon }}</mat-icon>
            @if (!isCollapsed()) {
              <span class="sidebar__nav-label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <!-- User Section -->
      <div class="sidebar__footer">
        <div class="sidebar__user" [class.sidebar__user--collapsed]="isCollapsed()">
          <app-avatar
            [name]="authService.userFullName()"
            [size]="isCollapsed() ? 32 : 36"
          />
          @if (!isCollapsed()) {
            <div class="sidebar__user-info">
              <span class="sidebar__user-name">{{ authService.userFullName() }}</span>
              <span class="sidebar__user-role">{{ authService.userRole() }}</span>
            </div>
          }
        </div>
      </div>
    </aside>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: $sidebar-width;
      background: $surface;
      border-right: 1px solid $border;
      display: flex;
      flex-direction: column;
      z-index: $z-fixed;
      transition: all $transition-normal;
      @include custom-scrollbar;

      @include mobile-only {
        transform: translateX(-100%);

        &--open {
          transform: translateX(0);
          box-shadow: $shadow-xl;
        }
      }

      &--collapsed {
        width: $sidebar-collapsed;
      }

      // ─── Brand ───
      &__brand {
        @include flex-start;
        gap: $spacing-3;
        padding: $spacing-5 $spacing-4;
        border-bottom: 1px solid $border-light;
        min-height: $topbar-height;
      }

      &__logo {
        @include flex-center;
        width: 40px;
        height: 40px;
        border-radius: $radius-lg;
        background: $gradient-primary;
        flex-shrink: 0;
      }

      &__logo-icon {
        color: $text-inverse;
        font-size: 22px;
      }

      &__brand-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      &__brand-name {
        font-size: $font-size-base;
        font-weight: $font-weight-bold;
        color: $text-primary;
        @include text-truncate;
      }

      &__brand-tagline {
        font-size: $font-size-xs;
        color: $text-muted;
        @include text-truncate;
      }

      &__collapse-btn {
        margin-left: auto;
        flex-shrink: 0;

        @include mobile-only {
          display: none;
        }
      }

      // ─── Navigation ───
      &__nav {
        flex: 1;
        padding: $spacing-3;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: $spacing-1;
      }

      &__nav-item {
        @include flex-start;
        gap: $spacing-3;
        padding: $spacing-3 $spacing-4;
        border-radius: $radius-md;
        color: $text-secondary;
        text-decoration: none;
        font-size: $font-size-sm;
        font-weight: $font-weight-medium;
        transition: all $transition-fast;
        cursor: pointer;

        &:hover {
          background: $primary-light;
          color: $primary;
          text-decoration: none;

          .sidebar__nav-icon {
            color: $primary;
          }
        }

        &--active {
          background: $primary-light;
          color: $primary;
          font-weight: $font-weight-semibold;

          .sidebar__nav-icon {
            color: $primary;
          }
        }
      }

      &__nav-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: $icon-secondary;
        flex-shrink: 0;
        transition: color $transition-fast;
      }

      &__nav-label {
        @include text-truncate;
      }

      // ─── Footer / User ───
      &__footer {
        border-top: 1px solid $border-light;
        padding: $spacing-3;
      }

      &__user {
        @include flex-start;
        gap: $spacing-3;
        padding: $spacing-3;
        border-radius: $radius-md;
        transition: background $transition-fast;
        cursor: default;

        &--collapsed {
          justify-content: center;
          padding: $spacing-2;
        }

        &:hover {
          background: $background;
        }
      }

      &__user-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      &__user-name {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $text-primary;
        @include text-truncate;
      }

      &__user-role {
        font-size: $font-size-xs;
        color: $text-muted;
        text-transform: capitalize;
      }
    }
  `],
})
export class SidebarComponent {
  readonly isOpen = input(false);
  readonly isCollapsed = input(false);
  readonly toggle = output<void>();
  readonly collapse = output<void>();

  readonly navItems = computed<NavItem[]>(() => {
    const role = this.authService.userRole();
    if (role === 'admin') {
      return [
        { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
        { label: 'User Control', icon: 'people', route: '/admin/users' },
        { label: 'Departments', icon: 'business', route: '/admin/departments' },
        { label: 'Audit Reports', icon: 'description', route: '/admin/reports' },
        { label: 'System Ledger', icon: 'receipt_long', route: '/admin/audit-logs' },
        { label: 'Announcements', icon: 'campaign', route: '/admin/roles-broadcast' },
        { label: 'Settings', icon: 'settings', route: '/settings' },
      ];
    } else if (role === 'officer') {
      return [
        { label: 'Dashboard', icon: 'dashboard', route: '/officer/dashboard' },
        { label: 'Complaints', icon: 'assignment_late', route: '/officer/complaints' },
        { label: 'Settings', icon: 'settings', route: '/settings' },
      ];
    } else if (role === 'field_worker') {
      return [
        { label: 'Active Tasks', icon: 'build', route: '/field-worker/dashboard' },
        { label: 'Settings', icon: 'settings', route: '/settings' },
      ];
    }
    return [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      { label: 'Report Issue', icon: 'add_circle_outline', route: '/report' },
      { label: 'My Complaints', icon: 'assignment', route: '/complaints' },
      { label: 'Settings', icon: 'settings', route: '/settings' },
    ];
  });

  constructor(readonly authService: AuthService) {}

  onNavClick(): void {
    if (window.innerWidth < 992) {
      this.toggle.emit();
    }
  }
}
