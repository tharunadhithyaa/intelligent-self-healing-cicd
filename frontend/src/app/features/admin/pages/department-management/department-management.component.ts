import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
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
import { Department } from '../../../../core/models/admin.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    <div class="department-management-container animate-fade-in-up">
      <app-page-header
        title="Department Administration"
        subtitle="Define municipal departments, configure support contact sheets, and manage officer rosters."
      ></app-page-header>

      <div class="workspace-layout">
        <!-- Roster / Listing of Agencies -->
        <div class="list-section">
          @if (loading()) {
            <div class="loader-box">
              <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
            </div>
          } @else if (departments().length === 0) {
            <div class="empty-state">
              <mat-icon>business</mat-icon>
              <p>No departments configured. Use the right form to create one.</p>
            </div>
          } @else {
            <div class="departments-grid">
              @for (d of departments(); track d._id) {
                <mat-card class="dept-card">
                  <mat-card-header>
                    <mat-card-title>{{ d.name }}</mat-card-title>
                    <mat-card-subtitle>{{ d.contactInfo }}</mat-card-subtitle>
                    <span class="status-badge" [ngClass]="d.status">{{
                      d.status | uppercase
                    }}</span>
                  </mat-card-header>
                  <mat-card-content>
                    <p class="description">{{ d.description }}</p>

                    <!-- Assigned Officers -->
                    <div class="officers-section">
                      <h4>Assigned Personnel ({{ d.officers.length }})</h4>
                      @if (d.officers.length === 0) {
                        <div class="no-officers">No personnel assigned to this department.</div>
                      } @else {
                        <div class="officers-list">
                          @for (off of d.officers; track off._id) {
                            <span class="officer-chip">
                              <mat-icon>person</mat-icon>
                              <span class="name">{{ off.firstName }} {{ off.lastName }}</span>
                              <button
                                (click)="removeOfficer(d._id, off._id)"
                                title="Remove officer from roster"
                                class="btn-remove-chip"
                              >
                                <mat-icon>close</mat-icon>
                              </button>
                            </span>
                          }
                        </div>
                      }
                    </div>

                    <!-- Assign officer selector -->
                    <div class="assign-action">
                      <mat-form-field appearance="outline" class="select-field">
                        <mat-label>Assign Personnel</mat-label>
                        <mat-select (selectionChange)="assignOfficer(d._id, $event.value)">
                          @for (o of availableOfficers(); track o._id) {
                            <mat-option [value]="o._id"
                              >{{ o.firstName }} {{ o.lastName }} ({{ o.role }})</mat-option
                            >
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </mat-card-content>
                  <mat-card-actions>
                    <button mat-stroked-button color="primary" (click)="editDepartment(d)">
                      <mat-icon>edit</mat-icon> Edit Details
                    </button>
                    <button mat-stroked-button color="warn" (click)="deleteDepartment(d)">
                      <mat-icon>delete</mat-icon> Delete Department
                    </button>
                  </mat-card-actions>
                </mat-card>
              }
            </div>
          }
        </div>

        <!-- Create/Edit Form card -->
        <div class="form-section">
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>{{
                isEditing() ? 'Modify Department' : 'Create Department'
              }}</mat-card-title>
              <mat-card-subtitle>{{
                isEditing()
                  ? 'Update details of the selected agency'
                  : 'Register a new support agency in CivicPulse'
              }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="deptForm" (ngSubmit)="saveDepartment()" class="dept-form">
                <mat-form-field appearance="outline">
                  <mat-label>Department Name</mat-label>
                  <input
                    matInput
                    formControlName="name"
                    placeholder="e.g. Sanitation, Transit Authority..."
                  />
                  @if (deptForm.get('name')?.hasError('required')) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Contact Coordinates (Email / Phone)</mat-label>
                  <input
                    matInput
                    formControlName="contactInfo"
                    placeholder="e.g. sanitation@civicpulse.org..."
                  />
                  @if (deptForm.get('contactInfo')?.hasError('required')) {
                    <mat-error>Contact coordinates are required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Agency Description</mat-label>
                  <textarea
                    matInput
                    formControlName="description"
                    rows="4"
                    placeholder="Brief outline of support services..."
                  ></textarea>
                  @if (deptForm.get('description')?.hasError('required')) {
                    <mat-error>Description is required</mat-error>
                  }
                </mat-form-field>

                @if (isEditing()) {
                  <mat-form-field appearance="outline">
                    <mat-label>Status</mat-label>
                    <mat-select formControlName="status">
                      <mat-option value="active">Active</mat-option>
                      <mat-option value="inactive">Inactive</mat-option>
                    </mat-select>
                  </mat-form-field>
                }

                <div class="form-buttons">
                  @if (isEditing()) {
                    <button mat-stroked-button type="button" (click)="resetForm()">Cancel</button>
                  }
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="deptForm.invalid"
                  >
                    {{ isEditing() ? 'Save Changes' : 'Create Department' }}
                  </button>
                </div>
              </form>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;

      .department-management-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .workspace-layout {
        display: grid;
        grid-template-columns: 1.8fr 1.2fr;
        gap: 24px;
        align-items: start;
        @media (max-width: 959px) {
          grid-template-columns: 1fr;
        }
      }

      .loader-box {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 60px 0;
      }

      .empty-state {
        text-align: center;
        padding: 48px;
        color: var(--text-secondary);
        background: var(--surface-card);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 8px;
        }
      }

      /* Grid cards */
      .departments-grid {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .dept-card {
        background: var(--surface-card);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        mat-card-header {
          position: relative;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        mat-card-title {
          font-size: 16px;
          font-weight: 700;
        }
        mat-card-subtitle {
          font-size: 11px;
          color: var(--primary-color);
          margin-top: 4px;
        }
        mat-card-content {
          padding: 20px;
        }
        mat-card-actions {
          padding: 12px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      }

      .status-badge {
        position: absolute;
        top: 16px;
        right: 20px;
        font-size: 9px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 20px;
        &.active {
          background: rgba(76, 175, 80, 0.12);
          color: #4caf50;
        }
        &.inactive {
          background: rgba(244, 67, 54, 0.12);
          color: var(--warn-color);
        }
      }

      .description {
        color: var(--text-primary);
        line-height: 1.5;
        font-size: 13px;
        margin: 0 0 20px 0;
      }

      /* Officers roster list inside cards */
      .officers-section {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.04);
        padding: 14px;
        border-radius: 8px;
        margin-bottom: 16px;
        h4 {
          margin: 0 0 10px 0;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-secondary);
          letter-spacing: 0.5px;
        }
        .no-officers {
          font-size: 12px;
          color: var(--text-secondary);
          font-style: italic;
        }
      }

      .officers-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .officer-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 4px 8px 4px 6px;
        border-radius: 6px;
        font-size: 11px;
        color: var(--text-primary);
        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: var(--primary-color);
        }
        .btn-remove-chip {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          &:hover {
            color: var(--warn-color);
          }
          mat-icon {
            font-size: 12px;
            width: 12px;
            height: 12px;
            color: inherit;
          }
        }
      }

      .assign-action {
        .select-field {
          width: 100%;
          margin: 0;
        }
      }

      /* Form Card styling */
      .form-card {
        background: var(--surface-card);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        mat-card-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        mat-card-title {
          font-size: 16px;
          font-weight: 700;
        }
        mat-card-subtitle {
          font-size: 11px;
          color: var(--text-secondary);
        }
        mat-card-content {
          padding: 20px;
        }
      }

      .dept-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        mat-form-field {
          width: 100%;
        }
        .form-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
      }
    `,
  ],
})
export class DepartmentManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  loading = signal<boolean>(true);
  departments = signal<Department[]>([]);
  availableOfficers = signal<User[]>([]);

  isEditing = signal<boolean>(false);
  editingId = signal<string | null>(null);

  deptForm!: FormGroup;

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadAvailableOfficers();
  }

  initForm(): void {
    this.deptForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      contactInfo: ['', [Validators.required]],
      status: ['active'],
    });
  }

  loadDepartments(): void {
    this.loading.set(true);
    this.adminService.getDepartments().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.departments.set(res.data.departments);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to fetch departments');
        this.loading.set(false);
      },
    });
  }

  loadAvailableOfficers(): void {
    // Fetch users with officer / field_worker roles to fill the select list
    this.adminService.getUsers({ page: 1, limit: 100 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Filter to officers or field workers
          const officers = res.data.users.filter(
            (u) => u.role === 'officer' || u.role === 'field_worker',
          );
          this.availableOfficers.set(officers);
        }
      },
    });
  }

  saveDepartment(): void {
    if (this.deptForm.invalid) return;

    const payload = this.deptForm.value;

    if (this.isEditing()) {
      const id = this.editingId()!;
      this.adminService.updateDepartment(id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Department updated successfully');
            this.resetForm();
            this.loadDepartments();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || 'Failed to update department');
        },
      });
    } else {
      this.adminService.createDepartment(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Department created successfully');
            this.resetForm();
            this.loadDepartments();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || 'Failed to create department');
        },
      });
    }
  }

  editDepartment(dept: Department): void {
    this.isEditing.set(true);
    this.editingId.set(dept._id);
    this.deptForm.patchValue({
      name: dept.name,
      description: dept.description,
      contactInfo: dept.contactInfo,
      status: dept.status,
    });
  }

  deleteDepartment(dept: Department): void {
    if (
      confirm(
        `WARNING: Are you sure you want to delete the department "${dept.name}"? This action is permanent and cannot be undone.`,
      )
    ) {
      this.adminService.deleteDepartment(dept._id).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Department deleted successfully');
            this.loadDepartments();
          }
        },
        error: (err) => {
          // Trigger error if active complaints assignment exists
          this.notificationService.error(err.error?.message || 'Failed to delete department');
        },
      });
    }
  }

  assignOfficer(deptId: string, officerId: string): void {
    if (!officerId) return;

    this.adminService.assignOfficer(deptId, officerId).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Officer assigned successfully');
          this.loadDepartments();
        }
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to assign officer');
      },
    });
  }

  removeOfficer(deptId: string, officerId: string): void {
    if (confirm('Are you sure you want to remove this officer from the department roster?')) {
      this.adminService.removeOfficer(deptId, officerId).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Officer removed from roster');
            this.loadDepartments();
          }
        },
        error: (err) => {
          this.notificationService.error(err.error?.message || 'Failed to remove officer');
        },
      });
    }
  }

  resetForm(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.deptForm.reset({
      name: '',
      description: '',
      contactInfo: '',
      status: 'active',
    });
  }
}
