import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FieldWorkerService } from '../../../../core/services/field-worker.service';
import { Complaint } from '../../../../core/models/complaint.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-worker-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      title="Field Responder Portal"
      subtitle="View assignments, update work status, and upload repair logs"
    />

    <!-- GPS Diagnostics Widget -->
    <mat-card class="gps-card">
      <mat-card-content class="gps-content">
        <div class="gps-info">
          <mat-icon [class.connected]="gpsConnected()">location_searching</mat-icon>
          <div class="gps-text">
            <span>Responder Geolocation: Active</span>
            <small>Coords: {{ mockLat }}, {{ mockLng }} (Accuracy: 10m)</small>
          </div>
        </div>
        <button
          mat-stroked-button
          color="primary"
          [disabled]="refreshingGps()"
          (click)="refreshGPS()"
        >
          @if (refreshingGps()) {
            <mat-progress-spinner
              mode="indeterminate"
              diameter="15"
              style="display:inline-block"
            ></mat-progress-spinner>
          } @else {
            <ng-container> <mat-icon>refresh</mat-icon> Refresh GPS </ng-container>
          }
        </button>
      </mat-card-content>
    </mat-card>

    <!-- Task List / Details View -->
    @if (loading()) {
      <div class="loader-box">
        <mat-progress-spinner mode="indeterminate" diameter="45"></mat-progress-spinner>
      </div>
    } @else if (jobs().length === 0) {
      <div class="empty-state">
        <mat-icon class="empty-icon">build_circle</mat-icon>
        <h3>No active assignments</h3>
        <p>You have resolved all assigned tickets! Stand by for dispatch updates.</p>
      </div>
    } @else {
      <div class="responder-container">
        <!-- List of active jobs -->
        <div class="jobs-list" [ngClass]="{ 'hide-list': selectedJob() }">
          <h3>Your Active Assignments ({{ jobs().length }})</h3>
          @for (job of jobs(); track job._id) {
            <mat-card
              class="job-card"
              (click)="selectJob(job)"
              [class.active-card]="selectedJob()?._id === job._id"
            >
              <mat-card-content>
                <div class="job-header">
                  <span class="priority-tag" [ngClass]="job.aiAnalysis?.priority || 'medium'">
                    {{ job.aiAnalysis?.priority?.toUpperCase() || 'MEDIUM' }}
                  </span>
                  <span class="status-tag" [ngClass]="job.status">{{
                    job.status.toUpperCase()
                  }}</span>
                </div>

                <h4 class="job-title">{{ job.title }}</h4>
                <p class="job-address">
                  <mat-icon>location_on</mat-icon> {{ job.location.address }}
                </p>

                <div class="job-footer">
                  <small>Assigned: {{ job.createdAt | date: 'shortDate' }}</small>
                  <span class="action-link">Open Details</span>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>

        <!-- Job detail panel -->
        @if (selectedJob(); as job) {
          <div class="job-detail">
            <!-- Back button for mobile view -->
            <button mat-stroked-button class="mobile-back-btn" (click)="clearSelection()">
              <mat-icon>arrow_back</mat-icon> Back to Assignments list
            </button>

            <mat-card class="detail-card">
              <mat-card-header>
                <mat-card-title>{{ job.title }}</mat-card-title>
                <mat-card-subtitle
                  >Status:
                  <span class="status-tag" [ngClass]="job.status">{{
                    job.status.toUpperCase()
                  }}</span></mat-card-subtitle
                >
              </mat-card-header>
              <mat-card-content>
                <p class="description">{{ job.description }}</p>

                <!-- Navigation Launcher -->
                <div class="nav-launcher">
                  <div class="nav-text">
                    <mat-icon>place</mat-icon>
                    <div>
                      <span>{{ job.location.address }}</span>
                      <small
                        >Coordinates: {{ job.location.latitude }},
                        {{ job.location.longitude }}</small
                      >
                    </div>
                  </div>
                  <a
                    mat-flat-button
                    color="primary"
                    [href]="getNavigationLink(job.location.latitude, job.location.longitude)"
                    target="_blank"
                  >
                    <mat-icon>navigation</mat-icon> Start GPS Navigation
                  </a>
                </div>

                <!-- Touch controls -->
                <div class="action-buttons">
                  @if (job.status === 'assigned') {
                    <button mat-flat-button class="btn-start" (click)="updateStatus('in_progress')">
                      <mat-icon>play_arrow</mat-icon> Start Repair Work
                    </button>
                  }
                  @if (job.status === 'in_progress') {
                    <button mat-flat-button class="btn-wait" (click)="updateStatus('waiting')">
                      <mat-icon>pause</mat-icon> Request Waiting / Parts
                    </button>
                    <button mat-flat-button class="btn-resolve" (click)="resolveJobPrompt()">
                      <mat-icon>check</mat-icon> Mark Job Completed
                    </button>
                  }
                  @if (job.status === 'waiting') {
                    <button mat-flat-button class="btn-start" (click)="updateStatus('in_progress')">
                      <mat-icon>play_arrow</mat-icon> Resume Repair Work
                    </button>
                  }
                </div>

                <!-- Resolution form popup placeholder -->
                @if (showResolutionForm()) {
                  <div class="resolution-form">
                    <h4>Submit Resolution Notes</h4>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Provide completion details...</mat-label>
                      <textarea
                        matInput
                        [(ngModel)]="completionNotes"
                        placeholder="Explain what repairs were done..."
                      ></textarea>
                    </mat-form-field>
                    <div class="form-actions">
                      <button mat-stroked-button (click)="showResolutionForm.set(false)">
                        Cancel
                      </button>
                      <button
                        mat-flat-button
                        color="accent"
                        [disabled]="!completionNotes.trim()"
                        (click)="submitResolution()"
                      >
                        Submit Resolution
                      </button>
                    </div>
                  </div>
                }

                <!-- Photo Uploader Section -->
                <div class="photo-uploads">
                  <h3>Upload Before / After Photos</h3>

                  <div class="uploader-grid">
                    <!-- Before photos -->
                    <div class="uploader-box">
                      <h5>Before Repairs ({{ job.beforeImages?.length || 0 }})</h5>
                      <div class="preview-row">
                        @for (img of job.beforeImages; track $index) {
                          <img [src]="img.base64Data" class="thumbnail" />
                        }
                      </div>
                      <label class="file-label" for="before-photo-input">
                        <input
                          id="before-photo-input"
                          name="beforePhoto"
                          type="file"
                          (change)="onPhotoSelected($event, 'before')"
                          accept="image/*"
                          class="file-input"
                        />
                        <span class="btn-upload"
                          ><mat-icon>photo_camera</mat-icon> Add Before Photo</span
                        >
                      </label>
                    </div>

                    <!-- After photos -->
                    <div class="uploader-box">
                      <h5>After Repairs ({{ job.afterImages?.length || 0 }})</h5>
                      <div class="preview-row">
                        @for (img of job.afterImages; track $index) {
                          <img [src]="img.base64Data" class="thumbnail" />
                        }
                      </div>
                      <label class="file-label" for="after-photo-input">
                        <input
                          id="after-photo-input"
                          name="afterPhoto"
                          type="file"
                          (change)="onPhotoSelected($event, 'after')"
                          accept="image/*"
                          class="file-input"
                        />
                        <span class="btn-upload"
                          ><mat-icon>photo_camera</mat-icon> Add After Photo</span
                        >
                      </label>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .gps-card {
        margin-bottom: $spacing-4;
        border: 1px solid $border-light;
        background: $surface;
      }

      .gps-content {
        @include flex-between;
        flex-wrap: wrap;
        gap: $spacing-3;
      }

      .gps-info {
        @include flex-start;
        gap: $spacing-3;

        mat-icon {
          color: $text-muted;
          &.connected {
            color: #00b8d4;
            animation: pulse 2s infinite;
          }
        }

        .gps-text {
          display: flex;
          flex-direction: column;
          span {
            font-size: $font-size-sm;
            font-weight: $font-weight-semibold;
            color: $text-primary;
          }
          small {
            font-size: 10px;
            color: $text-muted;
          }
        }
      }

      .loader-box {
        @include flex-center;
        min-height: 250px;
      }

      .empty-state {
        text-align: center;
        padding: $spacing-8 $spacing-4;
        background: $surface;
        border-radius: $radius-lg;

        .empty-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: $text-muted;
          margin-bottom: $spacing-3;
        }
      }

      /* Container Layout */
      .responder-container {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: $spacing-6;

        @include tablet-only {
          grid-template-columns: 1fr;
        }
      }

      .jobs-list {
        display: flex;
        flex-direction: column;
        gap: $spacing-3;

        h3 {
          font-size: $font-size-sm;
          font-weight: $font-weight-semibold;
          color: $text-secondary;
          margin-bottom: $spacing-2;
        }

        @include tablet-only {
          &.hide-list {
            display: none;
          }
        }
      }

      .job-card {
        border: 1px solid $border-light;
        cursor: pointer;
        background: $surface;
        transition: all $transition-fast;

        &:hover {
          border-color: var(--primary-color, #6200ea);
        }

        &.active-card {
          border-color: var(--primary-color, #6200ea);
          background: rgba(98, 0, 234, 0.02);
        }

        .job-header {
          @include flex-between;
          margin-bottom: $spacing-2;
        }

        .job-title {
          font-size: $font-size-sm;
          font-weight: $font-weight-bold;
          color: $text-primary;
          margin: 0 0 6px 0;
        }

        .job-address {
          @include flex-start;
          gap: 4px;
          font-size: $font-size-xs;
          color: $text-secondary;
          margin: 0 0 $spacing-3 0;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }

        .job-footer {
          @include flex-between;
          font-size: 10px;
          color: $text-muted;

          .action-link {
            color: var(--primary-color, #6200ea);
            font-weight: $font-weight-semibold;
          }
        }
      }

      /* Details Panel */
      .job-detail {
        display: flex;
        flex-direction: column;
        gap: $spacing-3;
      }

      .mobile-back-btn {
        align-self: flex-start;
        margin-bottom: $spacing-2;
        display: none;

        @include tablet-only {
          display: flex;
        }
      }

      .detail-card {
        border: 1px solid $border-light;
        background: $surface;

        mat-card-header {
          margin-bottom: $spacing-4;
        }

        .description {
          font-size: $font-size-sm;
          color: $text-primary;
          line-height: 1.6;
          margin-bottom: $spacing-4;
        }
      }

      /* Navigation link */
      .nav-launcher {
        @include flex-between;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid $border-light;
        border-radius: $radius-md;
        padding: $spacing-3;
        margin-bottom: $spacing-4;

        @include mobile-only {
          flex-direction: column;
          align-items: stretch;
          gap: $spacing-3;
        }

        .nav-text {
          @include flex-start;
          gap: $spacing-3;
          color: $text-secondary;

          mat-icon {
            color: #00b8d4;
          }

          div {
            display: flex;
            flex-direction: column;
            span {
              font-size: $font-size-xs;
              font-weight: $font-weight-medium;
            }
            small {
              font-size: 10px;
              color: $text-muted;
            }
          }
        }
      }

      /* Action touch buttons */
      .action-buttons {
        display: flex;
        gap: $spacing-3;
        margin-bottom: $spacing-6;

        @include mobile-only {
          flex-direction: column;
        }

        button {
          flex: 1;
          font-weight: $font-weight-semibold;
        }

        .btn-start {
          background: var(--success);
          color: var(--text-inverse);
        }
        .btn-wait {
          background: var(--warning);
          color: var(--text-primary);
        }
        .btn-resolve {
          background: var(--info);
          color: var(--text-inverse);
        }
      }

      .resolution-form {
        background: color-mix(in srgb, var(--surface) 2%, transparent);
        border: 1px solid $border-light;
        border-radius: $radius-md;
        padding: $spacing-4;
        margin-bottom: $spacing-6;

        h4 {
          margin: 0 0 $spacing-3 0;
          font-size: $font-size-sm;
          font-weight: $font-weight-semibold;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: $spacing-3;
        }
      }

      /* Photos */
      .photo-uploads {
        border-top: 1px solid $border-light;
        padding-top: $spacing-4;

        h3 {
          font-size: $font-size-sm;
          font-weight: $font-weight-semibold;
          margin-bottom: $spacing-4;
        }
      }

      .uploader-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: $spacing-4;

        @include mobile-only {
          grid-template-columns: 1fr;
        }
      }

      .uploader-box {
        border: 1px dashed $border;
        border-radius: $radius-md;
        padding: $spacing-4;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $spacing-3;

        h5 {
          margin: 0;
          font-size: $font-size-xs;
          color: $text-secondary;
        }

        .preview-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;

          .thumbnail {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid $border-light;
          }
        }
      }

      .file-label {
        cursor: pointer;
        .file-input {
          display: none;
        }
        .btn-upload {
          @include flex-center;
          gap: 6px;
          font-size: 11px;
          font-weight: $font-weight-semibold;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid $border;
          padding: 6px 12px;
          border-radius: $radius-md;
          transition: background $transition-fast;

          &:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }

      /* Tags styling */
      .priority-tag {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;

        &.low {
          background: rgba(0, 230, 118, 0.1);
          color: #00e676;
        }
        &.medium {
          background: rgba(0, 184, 212, 0.1);
          color: #00b8d4;
        }
        &.high {
          background: rgba(255, 171, 0, 0.1);
          color: #ffab00;
        }
        &.critical {
          background: rgba(255, 61, 0, 0.1);
          color: #ff3d00;
        }
      }

      .status-tag {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 10px;

        &.submitted {
          background: rgba(255, 255, 255, 0.05);
          color: #b3b3b3;
        }
        &.verified {
          background: rgba(0, 184, 212, 0.1);
          color: #00b8d4;
        }
        &.assigned {
          background: rgba(98, 0, 234, 0.1);
          color: #6200ea;
        }
        &.in_progress {
          background: rgba(255, 171, 0, 0.1);
          color: #ffab00;
        }
        &.waiting {
          background: rgba(255, 61, 0, 0.1);
          color: #ff3d00;
        }
        &.resolved {
          background: rgba(0, 230, 118, 0.1);
          color: #00e676;
        }
        &.rejected {
          background: rgba(255, 61, 0, 0.15);
          color: #ff3d00;
        }
        &.closed {
          background: rgba(255, 255, 255, 0.1);
          color: #808080;
        }
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class WorkerDashboardComponent implements OnInit {
  private readonly fieldWorkerService = inject(FieldWorkerService);

  loading = signal<boolean>(true);
  jobs = signal<Complaint[]>([]);
  selectedJob = signal<Complaint | null>(null);

  // GPS Simulated Coords
  mockLat = 12.971598;
  mockLng = 77.594562;
  gpsConnected = signal<boolean>(true);
  refreshingGps = signal<boolean>(false);

  // Form controls
  showResolutionForm = signal<boolean>(false);
  completionNotes = '';

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    this.fieldWorkerService.getAssignedJobs({ page: 1, limit: 50 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.jobs.set(res.data.jobs);
          // Auto-select first if none is active
          if (res.data.jobs.length > 0 && !this.selectedJob()) {
            this.selectedJob.set(res.data.jobs[0]);
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectJob(job: Complaint): void {
    this.selectedJob.set(job);
    this.showResolutionForm.set(false);
  }

  clearSelection(): void {
    this.selectedJob.set(null);
  }

  getNavigationLink(lat: number, lng: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  refreshGPS(): void {
    this.refreshingGps.set(true);
    setTimeout(() => {
      // Simulate GPS coordinate jitter/updates
      const randomValues = new Uint32Array(2);
      crypto.getRandomValues(randomValues);
      this.mockLat = 12.971598 + (randomValues[0] / 4294967296 - 0.5) * 0.002;
      this.mockLng = 77.594562 + (randomValues[1] / 4294967296 - 0.5) * 0.002;
      this.refreshingGps.set(false);
    }, 1200);
  }

  updateStatus(status: string): void {
    const job = this.selectedJob();
    if (!job) return;

    this.fieldWorkerService
      .updateJobStatus(job._id, status, `Field Responder initialized status: ${status}`)
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedJob.set(res.data.job);
            this.loadJobs();
          }
        },
      });
  }

  resolveJobPrompt(): void {
    this.completionNotes = '';
    this.showResolutionForm.set(true);
  }

  submitResolution(): void {
    const job = this.selectedJob();
    if (!job || !this.completionNotes.trim()) return;

    this.fieldWorkerService
      .updateJobStatus(job._id, 'resolved', this.completionNotes.trim())
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedJob.set(null);
            this.showResolutionForm.set(false);
            this.loadJobs();
          }
        },
      });
  }

  onPhotoSelected(event: any, type: 'before' | 'after'): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const payload = {
        base64Data,
        contentType: file.type,
        fileName: file.name,
      };

      const job = this.selectedJob();
      if (!job) return;

      this.fieldWorkerService.uploadPhotos(job._id, type, [payload]).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedJob.set(res.data.job);
            this.loadJobs();
          }
        },
      });
    };
    reader.readAsDataURL(file);
  }
}
