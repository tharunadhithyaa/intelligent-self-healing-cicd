import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="user-management-container animate-fade-in-up">
      <app-page-header
        title="Identity & Access Control"
        subtitle="Configure system access, activate/deactivate accounts, lock records, or perform password updates."
      ></app-page-header>

      <div class="control-bar">
        <div class="search-filters">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search users...</mat-label>
            <input
              matInput
              [(ngModel)]="searchQuery"
              (input)="onSearchChange()"
              placeholder="Search by name, email, or phone..."
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="status-field">
            <mat-label>Status Filter</mat-label>
            <mat-select [(ngModel)]="statusFilter" (selectionChange)="loadUsers()">
              <mat-option value="all">All Accounts</mat-option>
              <mat-option value="active">Active Only</mat-option>
              <mat-option value="inactive">Inactive Only</mat-option>
              <mat-option value="locked">Locked Only</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <mat-card class="table-card">
        <mat-tab-group (selectedTabChange)="onRoleTabChange($event)" class="role-tabs">
          <mat-tab label="Citizens" data-role="citizen"></mat-tab>
          <mat-tab label="Officers" data-role="officer"></mat-tab>
          <mat-tab label="Field Workers" data-role="field_worker"></mat-tab>
          <mat-tab label="Administrators" data-role="admin"></mat-tab>
        </mat-tab-group>

        <div class="table-container">
          @if (loading()) {
            <div class="table-spinner">
              <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
            </div>
          } @else if (users().length === 0) {
            <div class="empty-state">
              <mat-icon>people_outline</mat-icon>
              <p>No user accounts matched the selected query</p>
            </div>
          } @else {
            <table class="users-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Contact Details</th>
                  <th>Last Online</th>
                  <th>Security Status</th>
                  <th style="text-align: right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u._id) {
                  <tr>
                    <td>
                      <div class="user-badge">
                        <div class="avatar">{{ u.firstName[0] }}{{ u.lastName[0] }}</div>
                        <div class="info">
                          <span class="name">{{ u.firstName }} {{ u.lastName }}</span>
                          <span class="role">{{ u.role | uppercase }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="contact">
                        <span class="email">{{ u.email }}</span>
                        <span class="phone">{{ u.phone || 'No phone recorded' }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="last-login">{{
                        u.lastLogin ? (u.lastLogin | date: 'short') : 'Never logged in'
                      }}</span>
                    </td>
                    <td>
                      <div class="status-indicators">
                        @if (u.isLocked) {
                          <span class="badge locked"><mat-icon>lock</mat-icon> Locked</span>
                        } @else if (!u.isActive) {
                          <span class="badge inactive">Inactive</span>
                        } @else {
                          <span class="badge active">Active</span>
                        }
                      </div>
                    </td>
                    <td align="right">
                      <div class="action-buttons">
                        <!-- Reset password -->
                        <button
                          mat-icon-button
                          (click)="resetPassword(u)"
                          title="Reset password to temporary default"
                        >
                          <mat-icon>lock_reset</mat-icon>
                        </button>

                        <!-- Lock/Unlock account -->
                        <button
                          mat-icon-button
                          (click)="toggleLock(u)"
                          [ngClass]="{ locked: u.isLocked }"
                          title="Lock/Unlock account"
                        >
                          <mat-icon>{{ u.isLocked ? 'lock_open' : 'lock' }}</mat-icon>
                        </button>

                        <!-- Activate/Deactivate -->
                        <button
                          mat-flat-button
                          [ngClass]="u.isActive ? 'btn-deactivate' : 'btn-activate'"
                          (click)="toggleStatus(u)"
                        >
                          {{ u.isActive ? 'Deactivate' : 'Activate' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;

      .user-management-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .search-filters {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        width: 100%;
        .search-field {
          flex: 1;
          min-width: 280px;
        }
        .status-field {
          width: 200px;
        }
      }

      .table-card {
        background: var(--surface-card);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        overflow: hidden;
      }

      .role-tabs {
        background: rgba(255, 255, 255, 0.01);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .table-container {
        padding: 16px;
        min-height: 250px;
        position: relative;
      }

      .table-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 60px 0;
      }

      .empty-state {
        text-align: center;
        padding: 60px 0;
        color: var(--text-secondary);
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 8px;
        }
      }

      .users-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 13px;

        th {
          padding: 12px;
          color: var(--text-secondary);
          font-weight: 600;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        td {
          padding: 14px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          vertical-align: middle;
        }

        tr:hover td {
          background: rgba(255, 255, 255, 0.01);
        }
      }

      /* User Badge */
      .user-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--primary-color);
          color: var(--text-inverse);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
        }
        .info {
          display: flex;
          flex-direction: column;
          .name {
            font-weight: 600;
            color: var(--text-primary);
          }
          .role {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 2px;
            font-weight: 600;
          }
        }
      }

      /* Contact info */
      .contact {
        display: flex;
        flex-direction: column;
        .email {
          color: var(--text-primary);
        }
        .phone {
          color: var(--text-secondary);
          font-size: 11px;
          margin-top: 2px;
        }
      }

      /* Badges */
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        &.active {
          background: rgba(76, 175, 80, 0.12);
          color: #4caf50;
        }
        &.inactive {
          background: rgba(255, 152, 0, 0.12);
          color: #ff9800;
        }
        &.locked {
          background: rgba(244, 67, 54, 0.12);
          color: var(--warn-color);
          mat-icon {
            font-size: 11px;
            width: 11px;
            height: 11px;
          }
        }
      }

      /* Actions styling */
      .action-buttons {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        button[mat-icon-button] {
          color: var(--text-secondary);
          &:hover {
            color: var(--text-primary);
          }
          &.locked {
            color: var(--warn-color);
          }
        }
      }

      .btn-deactivate {
        background: rgba(244, 67, 54, 0.15) !important;
        color: var(--warn-color) !important;
        border: 1px solid rgba(244, 67, 54, 0.2);
      }

      .btn-activate {
        background: rgba(76, 175, 80, 0.15) !important;
        color: #4caf50 !important;
        border: 1px solid rgba(76, 175, 80, 0.2);
      }
    `,
  ],
})
export class UserManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notificationService = inject(NotificationService);

  loading = signal<boolean>(true);
  users = signal<User[]>([]);

  // Search filter options
  searchQuery = '';
  statusFilter = 'all';
  selectedRole = 'citizen';

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);

    const params: Record<string, any> = {
      role: this.selectedRole,
      page: 1,
      limit: 50,
    };

    if (this.searchQuery) {
      params['search'] = this.searchQuery;
    }

    if (this.statusFilter === 'active') {
      params['isActive'] = true;
      params['isLocked'] = false;
    } else if (this.statusFilter === 'inactive') {
      params['isActive'] = false;
    } else if (this.statusFilter === 'locked') {
      params['isLocked'] = true;
    }

    this.adminService.getUsers(params).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.users.set(res.data.users);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to fetch user accounts');
        this.loading.set(false);
      },
    });
  }

  onSearchChange(): void {
    this.loadUsers();
  }

  onRoleTabChange(event: any): void {
    const roles = ['citizen', 'officer', 'field_worker', 'admin'];
    this.selectedRole = roles[event.index];
    this.loadUsers();
  }

  toggleStatus(u: User): void {
    const nextState = !u.isActive;
    const actionLabel = nextState ? 'activate' : 'deactivate';

    if (confirm(`Are you sure you want to ${actionLabel} ${u.firstName}'s account?`)) {
      this.adminService.toggleUserStatus(u._id, nextState).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success(
              `Account for ${u.firstName} successfully ${actionLabel}d`,
            );
            this.loadUsers();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || `Failed to ${actionLabel} account`);
        },
      });
    }
  }

  toggleLock(u: User): void {
    const nextState = !u.isLocked;
    const actionLabel = nextState ? 'lock' : 'unlock';

    if (confirm(`Are you sure you want to ${actionLabel} this account?`)) {
      this.adminService.toggleUserLock(u._id, nextState).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success(`Account for ${u.firstName} is now ${actionLabel}ed`);
            this.loadUsers();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || `Failed to update lock status`);
        },
      });
    }
  }

  resetPassword(u: User): void {
    if (
      confirm(
        `Are you sure you want to reset password for ${u.firstName} ${u.lastName}? This will set it to a default temporary state.`,
      )
    ) {
      this.adminService.resetUserPassword(u._id).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            alert(
              `Password reset successful!\nThe new temporary password is: ${res.data.defaultPassword}\n\nPlease share this securely with the user.`,
            );
            this.notificationService.success(`Password reset completed for ${u.firstName}`);
            this.loadUsers();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || 'Failed to reset password');
        },
      });
    }
  }
}
