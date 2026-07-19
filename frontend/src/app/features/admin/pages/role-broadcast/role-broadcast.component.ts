import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-role-broadcast',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent
  ],
  template: `
    <div class="role-broadcast-container animate-fade-in-up">
      <app-page-header title="Roles & Announcements Control" subtitle="Configure system permissions checklists and broadcast system-wide notices."></app-page-header>

      <mat-card class="main-card">
        <mat-tab-group class="control-tabs">
          <!-- Announcements Broadcast Tab -->
          <mat-tab label="System Broadcasts">
            <div class="tab-content">
              <div class="broadcast-layout">
                <div class="form-side">
                  <h3>Compose Announcement</h3>
                  <p class="section-desc">Broadcast high-priority in-app announcements directly to active user roles.</p>

                  <form [formGroup]="broadcastForm" (ngSubmit)="sendBroadcast()" class="broadcast-form">
                    <mat-form-field appearance="outline">
                      <mat-label>Announcement Title</mat-label>
                      <input matInput formControlName="title" placeholder="e.g. Schedule Maintenance, Policy Updates...">
                      @if (broadcastForm.get('title')?.hasError('required')) {
                        <mat-error>Title is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Announcement Message</mat-label>
                      <textarea matInput formControlName="message" rows="5" placeholder="Enter broadcast message detail..."></textarea>
                      @if (broadcastForm.get('message')?.hasError('required')) {
                        <mat-error>Message body is required</mat-error>
                      }
                    </mat-form-field>

                    <div class="target-roles-section">
                      <h4>Recipient Audience Target</h4>
                      <div class="checkbox-row">
                        <mat-checkbox formControlName="targetCitizen">Citizens</mat-checkbox>
                        <mat-checkbox formControlName="targetOfficer">Officers</mat-checkbox>
                        <mat-checkbox formControlName="targetFieldWorker">Field Workers</mat-checkbox>
                      </div>
                      <span class="warning-text">* If no audience target is selected, announcement broadcasts to all users.</span>
                    </div>

                    <div class="form-actions">
                      <button mat-flat-button color="primary" type="submit" [disabled]="broadcastForm.invalid || submitting()">
                        @if (submitting()) {
                          <mat-progress-spinner mode="indeterminate" diameter="18" style="display:inline-block; margin-right:8px"></mat-progress-spinner>
                          Broadcasting...
                        } @else {
                          <span><mat-icon style="display: inline-block; vertical-align: middle; margin-right: 4px; font-size: 18px; width: 18px; height: 18px;">campaign</mat-icon> Broadcast Announcement</span>
                        }
                      </button>
                    </div>
                  </form>
                </div>

                <div class="preview-side">
                  <h3>Live Broadcast Preview</h3>
                  <div class="notification-preview">
                    <div class="preview-header">
                      <mat-icon class="announcement-icon">campaign</mat-icon>
                      <div class="title-meta">
                        <strong class="title">{{ broadcastForm.get('title')?.value || 'Notice Title' }}</strong>
                        <span class="date">Just Now • System Broadcast</span>
                      </div>
                    </div>
                    <div class="preview-body">
                      {{ broadcastForm.get('message')?.value || 'Compose your announcement message on the left to review its layout preview here...' }}
                    </div>
                    <div class="preview-footer">
                      <button mat-button disabled>Mark as Read</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Roles & Permissions Tab -->
          <mat-tab label="Permissions Matrix">
            <div class="tab-content">
              <h3>Role Authorization Control</h3>
              <p class="section-desc">Inspect dynamic permission capabilities associated with default system roles in CivicPulse.</p>

              <div class="matrix-container">
                <table class="matrix-table">
                  <thead>
                    <tr>
                      <th>System Permission</th>
                      <th align="center">Citizen</th>
                      <th align="center">Officer</th>
                      <th align="center">Field Worker</th>
                      <th align="center">Administrator</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of permissionsMatrix; track p.key) {
                      <tr>
                        <td class="perm-desc">
                          <strong>{{ p.name }}</strong>
                          <span>{{ p.description }}</span>
                        </td>
                        <td align="center">
                          <mat-icon [ngClass]="p.citizen ? 'check' : 'cross'">
                            {{ p.citizen ? 'check_circle' : 'cancel' }}
                          </mat-icon>
                        </td>
                        <td align="center">
                          <mat-icon [ngClass]="p.officer ? 'check' : 'cross'">
                            {{ p.officer ? 'check_circle' : 'cancel' }}
                          </mat-icon>
                        </td>
                        <td align="center">
                          <mat-icon [ngClass]="p.fieldWorker ? 'check' : 'cross'">
                            {{ p.fieldWorker ? 'check_circle' : 'cancel' }}
                          </mat-icon>
                        </td>
                        <td align="center">
                          <mat-icon [ngClass]="p.admin ? 'check' : 'cross'">
                            {{ p.admin ? 'check_circle' : 'cancel' }}
                          </mat-icon>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;

    .role-broadcast-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 32px;
    }

    .main-card {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      overflow: hidden;
    }

    .control-tabs {
      background: rgba(255, 255, 255, 0.01);
    }

    .tab-content {
      padding: 24px;
      h3 {
        margin: 0 0 4px 0;
        font-weight: 700;
        font-size: 16px;
      }
      .section-desc {
        color: var(--text-secondary);
        font-size: 13px;
        margin: 0 0 24px 0;
      }
    }

    /* Broadcast Tab Layout */
    .broadcast-layout {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 32px;
      @media (max-width: 959px) {
        grid-template-columns: 1fr;
      }
    }

    .broadcast-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      mat-form-field {
        width: 100%;
      }
    }

    .target-roles-section {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      padding: 16px;
      border-radius: 8px;
      h4 {
        margin: 0 0 10px 0;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.5px;
      }
      .checkbox-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .warning-text {
        display: block;
        font-size: 9px;
        color: var(--text-secondary);
        margin-top: 8px;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }

    /* Live Preview card */
    .notification-preview {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);

      .preview-header {
        display: flex;
        gap: 12px;
        align-items: center;
        .announcement-icon {
          color: var(--accent-color);
          background: rgba(0, 184, 212, 0.12);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .title-meta {
          display: flex;
          flex-direction: column;
          .title {
            color: var(--text-primary);
            font-size: 13px;
          }
          .date {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 2px;
          }
        }
      }

      .preview-body {
        font-size: 12px;
        color: var(--text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .preview-footer {
        display: flex;
        justify-content: flex-end;
        border-top: 1px solid rgba(255, 255, 255, 0.03);
        padding-top: 8px;
        button {
          font-size: 11px;
        }
      }
    }

    /* Permissions Matrix */
    .matrix-container {
      overflow-x: auto;
    }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
      th {
        padding: 12px;
        color: var(--text-secondary);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-weight: 600;
        text-align: center;
        &:first-child {
          text-align: left;
        }
      }
      td {
        padding: 14px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        vertical-align: middle;
      }
      .perm-desc {
        display: flex;
        flex-direction: column;
        gap: 2px;
        strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        span {
          font-size: 11px;
          color: var(--text-secondary);
        }
      }
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        &.check {
          color: #4caf50;
        }
        &.cross {
          color: rgba(255, 255, 255, 0.1);
        }
      }
    }
  `]
})
export class RoleBroadcastComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  submitting = signal<boolean>(false);
  broadcastForm!: FormGroup;

  permissionsMatrix = [
    { key: 'users:view', name: 'View Users', description: 'Search and inspect registered user accounts.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'users:manage', name: 'Manage Users', description: 'Activate, lock, or reset password credentials.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'depts:manage', name: 'Manage Departments', description: 'Create support agencies, allocate officers, or delete rosters.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'reports:generate', name: 'Generate Reports', description: 'Export resolution counts or platform metrics to CSV.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'audit:view', name: 'View Audit Logs', description: 'Inspect the immutable control ledger trace log.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'analytics:view', name: 'View Analytics', description: 'Inspect statistics cards and volume charts.', citizen: false, officer: false, fieldWorker: false, admin: true },
    { key: 'complaints:view', name: 'View Incidents', description: 'Inspect and search complaint folders.', citizen: true, officer: true, fieldWorker: true, admin: true },
    { key: 'complaints:manage', name: 'Resolve Incidents', description: 'Review timelines, assign officers, and declare resolved status.', citizen: false, officer: true, fieldWorker: false, admin: true },
    { key: 'profile:manage', name: 'Manage Profile', description: 'Modify settings and security configuration tabs.', citizen: true, officer: true, fieldWorker: true, admin: true }
  ];

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {}

  initForm(): void {
    this.broadcastForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      message: ['', [Validators.required, Validators.minLength(10)]],
      targetCitizen: [false],
      targetOfficer: [false],
      targetFieldWorker: [false]
    });
  }

  sendBroadcast(): void {
    if (this.broadcastForm.invalid) return;

    this.submitting.set(true);
    const formVal = this.broadcastForm.value;

    const targetRoles: string[] = [];
    if (formVal.targetCitizen) targetRoles.push('citizen');
    if (formVal.targetOfficer) targetRoles.push('officer');
    if (formVal.targetFieldWorker) targetRoles.push('field_worker');

    const payload = {
      title: formVal.title,
      message: formVal.message,
      targetRoles
    };

    this.adminService.broadcastNotification(payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Global alert announcement broadcast successfully');
          this.broadcastForm.reset({
            title: '',
            message: '',
            targetCitizen: false,
            targetOfficer: false,
            targetFieldWorker: false
          });
        }
        this.submitting.set(false);
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to broadcast announcement');
        this.submitting.set(false);
      }
    });
  }
}
