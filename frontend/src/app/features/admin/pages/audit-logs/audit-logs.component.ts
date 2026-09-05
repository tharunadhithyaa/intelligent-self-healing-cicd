import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { AuditLog } from '../../../../core/models/admin.model';

@Component({
  selector: 'app-audit-logs',
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
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="audit-logs-container animate-fade-in-up">
      <app-page-header
        title="System Audit Ledger"
        subtitle="Immutable control logs documenting administrator actions, logins, and permission adjustments."
      ></app-page-header>

      <!-- Filter Controls panel -->
      <mat-card class="filter-card">
        <mat-card-content class="filter-grid">
          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Search Log Content</mat-label>
            <input
              matInput
              [(ngModel)]="searchQuery"
              (input)="onFilterChange()"
              placeholder="Search by email, action..."
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Filter by Action</mat-label>
            <mat-select [(ngModel)]="actionFilter" (selectionChange)="onFilterChange()">
              <mat-option value="">All Actions</mat-option>
              <mat-option value="login_success">Successful Logins</mat-option>
              <mat-option value="login_failed">Failed Logins</mat-option>
              <mat-option value="user_deactivated">User Deactivation</mat-option>
              <mat-option value="user_activated">User Activation</mat-option>
              <mat-option value="user_locked">Account Lock</mat-option>
              <mat-option value="department_created">Department Creation</mat-option>
              <mat-option value="department_deleted">Department Deletion</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Actor Role</mat-label>
            <mat-select [(ngModel)]="roleFilter" (selectionChange)="onFilterChange()">
              <mat-option value="">All Roles</mat-option>
              <mat-option value="admin">Administrators</mat-option>
              <mat-option value="officer">Officers</mat-option>
              <mat-option value="citizen">Citizens</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="date-inputs">
            <mat-form-field appearance="outline" class="date-pick">
              <mat-label>Start Date</mat-label>
              <input matInput type="date" [(ngModel)]="startDate" (change)="onFilterChange()" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="date-pick">
              <mat-label>End Date</mat-label>
              <input matInput type="date" [(ngModel)]="endDate" (change)="onFilterChange()" />
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Ledger logs grid -->
      <mat-card class="ledger-card">
        <div class="ledger-header">
          <h3>Activity Records ({{ total() }})</h3>
          <button mat-icon-button (click)="loadLogs()" title="Refresh Logs">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        <div class="ledger-table-container">
          @if (loading()) {
            <div class="spinner-box">
              <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
            </div>
          } @else if (logs().length === 0) {
            <div class="empty-state">
              <mat-icon>history</mat-icon>
              <p>No audit events match the selected criteria</p>
            </div>
          } @else {
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor / Role</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                @for (log of logs(); track log._id) {
                  <tr class="ledger-row">
                    <td class="time">{{ log.timestamp | date: 'medium' }}</td>
                    <td>
                      <div class="actor-info">
                        <span class="email">{{ log.actorEmail || 'System / Anonymous' }}</span>
                        <span class="role-badge" [ngClass]="log.actorRole">{{
                          log.actorRole || 'ANONYMOUS'
                        }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="action-tag" [ngClass]="log.action">{{ log.action }}</span>
                    </td>
                    <td>
                      @if (log.target) {
                        <span class="target-badge">
                          <strong>{{ log.target }}</strong
                          >: {{ log.targetId?.substring(18) }}..
                        </span>
                      } @else {
                        <span class="no-target">-</span>
                      }
                    </td>
                    <td>
                      @if (log.details) {
                        <button
                          mat-stroked-button
                          class="btn-meta"
                          (click)="toggleDetails(log._id)"
                        >
                          <mat-icon>analytics</mat-icon> View Metadata
                        </button>
                      } @else {
                        <span class="no-meta">No details recorded</span>
                      }
                    </td>
                  </tr>
                  @if (expandedLogId() === log._id) {
                    <tr class="details-row">
                      <td colspan="5">
                        <div class="expanded-box">
                          <pre class="json-code"><code>{{ log.details | json }}</code></pre>
                          <div class="device-info">
                            <span
                              ><strong>IP Address:</strong> {{ log.ipAddress || 'Unknown' }}</span
                            >
                            <span
                              ><strong>Client Agent:</strong> {{ log.userAgent || 'Unknown' }}</span
                            >
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>

            <!-- Pagination bar -->
            <div class="pagination">
              <button mat-stroked-button [disabled]="page() === 1" (click)="prevPage()">
                <mat-icon>chevron_left</mat-icon> Prev
              </button>
              <span class="page-num">Page {{ page() }} of {{ maxPages() }}</span>
              <button mat-stroked-button [disabled]="page() >= maxPages()" (click)="nextPage()">
                Next <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;

      .audit-logs-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-bottom: 32px;
      }

      .filter-card {
        background: var(--surface-card);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 16px;
      }

      .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        align-items: center;
        .filter-item {
          width: 100%;
          margin: 0;
        }
        .date-inputs {
          display: flex;
          gap: 8px;
          .date-pick {
            flex: 1;
            margin: 0;
          }
        }
      }

      .ledger-card {
        background: var(--surface-card);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      }

      .ledger-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        h3 {
          margin: 0;
          font-weight: 700;
          font-size: 15px;
        }
        button {
          color: var(--text-secondary);
        }
      }

      .ledger-table-container {
        padding: 16px;
        min-height: 250px;
        position: relative;
      }

      .spinner-box {
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

      .ledger-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        text-align: left;
        th {
          padding: 12px;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-weight: 600;
        }
        td {
          padding: 14px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          vertical-align: middle;
        }
        .ledger-row:hover td {
          background: rgba(255, 255, 255, 0.01);
        }
        .time {
          white-space: nowrap;
          color: var(--text-secondary);
        }
      }

      /* Actor info */
      .actor-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        .email {
          font-weight: 600;
          color: var(--text-primary);
        }
        .role-badge {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          &.admin {
            background: rgba(98, 0, 234, 0.12);
            color: var(--primary-color);
          }
          &.officer {
            background: rgba(0, 184, 212, 0.12);
            color: var(--accent-color);
          }
        }
      }

      /* Action Labels */
      .action-tag {
        font-size: 10px;
        font-family: monospace;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-primary);
        &.user_deactivated,
        &.user_locked,
        &.login_failed {
          background: rgba(244, 67, 54, 0.1);
          color: var(--warn-color);
        }
        &.user_activated,
        &.login_success {
          background: rgba(76, 175, 80, 0.1);
          color: #4caf50;
        }
        &.department_created,
        &.officer_assigned_to_department {
          background: rgba(0, 184, 212, 0.1);
          color: var(--accent-color);
        }
      }

      .target-badge {
        font-size: 11px;
        color: var(--text-secondary);
        background: rgba(255, 255, 255, 0.03);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.04);
      }

      .btn-meta {
        font-size: 11px;
        height: 28px;
        padding: 0 10px;
        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          margin-right: 4px;
        }
      }

      /* Expanded Details Box */
      .details-row td {
        background: rgba(0, 0, 0, 0.2);
        padding: 16px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .expanded-box {
        display: flex;
        flex-direction: column;
        gap: 12px;
        .json-code {
          margin: 0;
          padding: 12px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          font-family: monospace;
          font-size: 11px;
          color: #a5d6a7;
          overflow-x: auto;
        }
        .device-info {
          display: flex;
          gap: 20px;
          font-size: 10px;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }
      }

      /* Pagination controls */
      .pagination {
        margin-top: 16px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 16px;
        font-size: 12px;
        .page-num {
          color: var(--text-secondary);
          font-weight: 600;
        }
      }
    `,
  ],
})
export class AuditLogsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notificationService = inject(NotificationService);

  loading = signal<boolean>(true);
  logs = signal<AuditLog[]>([]);

  // Search parameters
  searchQuery = '';
  actionFilter = '';
  roleFilter = '';
  startDate = '';
  endDate = '';

  // Pagination states
  page = signal<number>(1);
  limit = 15;
  total = signal<number>(0);
  maxPages = computed(() => Math.ceil(this.total() / this.limit) || 1);

  // Accordion state
  expandedLogId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    const params: Record<string, any> = {
      page: this.page(),
      limit: this.limit,
    };

    if (this.searchQuery) params['search'] = this.searchQuery;
    if (this.actionFilter) params['action'] = this.actionFilter;
    if (this.roleFilter) params['role'] = this.roleFilter;
    if (this.startDate) params['startDate'] = this.startDate;
    if (this.endDate) params['endDate'] = this.endDate;

    this.adminService.getAuditLogs(params).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.logs.set(res.data.logs);
          this.total.set(res.data.total);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to query system audit logs');
        this.loading.set(false);
      },
    });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadLogs();
  }

  toggleDetails(id: string): void {
    if (this.expandedLogId() === id) {
      this.expandedLogId.set(null);
    } else {
      this.expandedLogId.set(id);
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.page() < this.maxPages()) {
      this.page.update((p) => p + 1);
      this.loadLogs();
    }
  }
}
