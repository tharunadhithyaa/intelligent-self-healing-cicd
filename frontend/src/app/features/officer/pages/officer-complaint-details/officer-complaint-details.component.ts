import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OfficerService } from '../../../../core/services/officer.service';
import { Complaint } from '../../../../core/models/complaint.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-officer-complaint-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    PageHeaderComponent
  ],
  template: `
    <div class="header-action">
      <button mat-icon-button routerLink="/officer/complaints">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <app-page-header
        [title]="'Incident File: #' + complaintId"
        subtitle="Manage status transitions, internal updates, and field assignments"
      />
    </div>

    @if (loading()) {
      <div class="loader-box">
        <mat-progress-spinner mode="indeterminate" diameter="45"></mat-progress-spinner>
      </div>
    } @else if (error()) {
      <div class="error-box">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <p>{{ error() }}</p>
        <button mat-flat-button color="primary" routerLink="/officer/complaints">Back to Roster</button>
      </div>
    } @else {
      @if (complaint(); as c) {
        <div class="details-grid">
        <!-- Main Details Section -->
        <div class="main-column">
          <!-- Primary Complaint Card -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-card-title>{{ c.title }}</mat-card-title>
              <mat-card-subtitle>Reported by {{ getCitizenName(c.citizen) }} • {{ c.createdAt | date:'medium' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p class="description-text">{{ c.description }}</p>

              <div class="meta-row">
                <div class="meta-item">
                  <mat-icon>location_on</mat-icon>
                  <span>{{ c.location.address }} ({{ c.location.latitude }}, {{ c.location.longitude }})</span>
                </div>
                <div class="meta-item">
                  <mat-icon>category</mat-icon>
                  <span>{{ c.category }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Before/After Attachments Card -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-card-title>Incident Photos & Repair Evidence</mat-card-title>
              <mat-card-subtitle>Photos captured from field devices</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <!-- Citizen Uploads -->
              <h4 class="sub-header">Citizen Submission Photos ({{ c.images.length }})</h4>
              @if (c.images.length === 0) {
                <p class="no-photos">No photos uploaded by citizen.</p>
              } @else {
                <div class="image-gallery">
                  @for (img of c.images; track $index) {
                    <div class="gallery-item">
                      <img [src]="img.base64Data" [alt]="img.fileName" />
                    </div>
                  }
                </div>
              }

              <!-- Field Worker Evidence Slider -->
              <div class="evidence-grid">
                <div class="evidence-box">
                  <h4 class="sub-header before-header">Before Repair ({{ c.beforeImages?.length || 0 }})</h4>
                  @if (!c.beforeImages || c.beforeImages.length === 0) {
                    <p class="no-photos">No "Before" photos uploaded yet.</p>
                  } @else {
                    <div class="image-gallery">
                      @for (img of c.beforeImages; track $index) {
                        <div class="gallery-item">
                          <img [src]="img.base64Data" [alt]="img.fileName" />
                        </div>
                      }
                    </div>
                  }
                </div>

                <div class="evidence-box">
                  <h4 class="sub-header after-header">After Repair ({{ c.afterImages?.length || 0 }})</h4>
                  @if (!c.afterImages || c.afterImages.length === 0) {
                    <p class="no-photos">No "After" photos uploaded yet.</p>
                  } @else {
                    <div class="image-gallery">
                      @for (img of c.afterImages; track $index) {
                        <div class="gallery-item">
                          <img [src]="img.base64Data" [alt]="img.fileName" />
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Internal Communications Board -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-card-title>Internal Officer Notes</mat-card-title>
              <mat-card-subtitle>Privileged communications (citizen cannot view)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="notes-list">
                @if (!c.internalNotes || c.internalNotes.length === 0) {
                  <p class="no-notes">No internal comments recorded.</p>
                } @else {
                  @for (note of c.internalNotes; track $index) {
                    <div class="note-item">
                      <div class="note-header">
                        <span class="note-author">{{ note.authorName }}</span>
                        <span class="note-time">{{ note.timestamp | date:'short' }}</span>
                      </div>
                      <p class="note-text">{{ note.text }}</p>
                    </div>
                  }
                }
              </div>

              <!-- Note Form -->
              <div class="note-form">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Add internal update note...</mat-label>
                  <textarea matInput [(ngModel)]="noteText" placeholder="Enter notes detail..."></textarea>
                </mat-form-field>
                <button mat-flat-button color="primary" [disabled]="!noteText.trim()" (click)="addInternalNote()">
                  Save Note
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Right Side Control Column -->
        <div class="side-column">
          <!-- AI Copilot Recommendations Widget -->
          <mat-card class="control-card ai-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon class="ai-icon">eco</mat-icon> AI Copilot suggestions
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="ai-widget">
                <div class="ai-item">
                  <span class="ai-label">Suggested Priority</span>
                  <div class="ai-row">
                    <span class="priority-tag" [ngClass]="c.aiAnalysis?.priority || 'medium'">
                      {{ c.aiAnalysis?.priority?.toUpperCase() || 'MEDIUM' }}
                    </span>
                    <span class="confidence">{{ c.aiAnalysis?.confidenceScore || 0 }}% Confidence</span>
                  </div>
                </div>

                <div class="ai-item">
                  <span class="ai-label">Recommended Agency</span>
                  <p class="ai-text">{{ c.aiAnalysis?.department || c.department }}</p>
                </div>

                @if (c.aiAnalysis?.duplicateDetected) {
                  <div class="ai-item duplicate-alert">
                    <div class="alert-header">
                      <mat-icon>warning</mat-icon>
                      <span>Potential Duplicate Detected</span>
                    </div>
                    <p class="alert-desc">{{ c.aiAnalysis?.duplicateWarning }}</p>
                  </div>
                }

                <div class="ai-item">
                  <span class="ai-label">Suggested Dispatch Action</span>
                  <p class="action-steps">
                    Verify location, assign a nearby field responder, and transition state to verified.
                  </p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Operations Control card -->
          <mat-card class="control-card">
            <mat-card-header>
              <mat-card-title>Operational controls</mat-card-title>
            </mat-card-header>
            <mat-card-content class="control-content">
              <!-- Current Status -->
              <div class="status-box">
                <span class="label">Current Status</span>
                <span class="status-tag" [ngClass]="c.status">{{ c.status.toUpperCase() }}</span>
              </div>

              <!-- Status Transition Selector -->
              <div class="form-section">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Modify status state</mat-label>
                  <mat-select [(ngModel)]="selectedStatus" (selectionChange)="onStatusChange()">
                    <mat-option value="verified">Verify Complaint</mat-option>
                    <mat-option value="waiting">Mark Pending/Waiting</mat-option>
                    <mat-option value="rejected">Reject Incident</mat-option>
                    <mat-option value="closed">Close File</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Field Worker Assign -->
              <div class="form-section">
                <span class="label">Dispatch Field Worker</span>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select active crew...</mat-label>
                  <mat-select [(ngModel)]="selectedWorker">
                    @for (w of availableWorkers(); track w._id) {
                      <mat-option [value]="w._id">{{ w.firstName }} {{ w.lastName }} ({{ w.phone }})</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button color="primary" [disabled]="!selectedWorker" (click)="assignWorker()" class="full-width">
                  Assign Crew
                </button>
              </div>

              <!-- Resolution Details -->
              @if (c.status !== 'resolved' && c.status !== 'closed') {
                <div class="form-section resolution-box">
                  <span class="label">Submit Resolution notes</span>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Resolution summary description...</mat-label>
                    <textarea matInput [(ngModel)]="resDescription" placeholder="Enter resolution details..."></textarea>
                  </mat-form-field>
                  <button mat-flat-button color="accent" [disabled]="!resDescription.trim()" (click)="submitResolution()" class="full-width">
                    Mark Resolved
                  </button>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Audit Timeline history -->
          <mat-card class="control-card">
            <mat-card-header>
              <mat-card-title>Incident Timeline logs</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="timeline">
                @for (t of c.timeline; track $index) {
                  <div class="timeline-item">
                    <div class="timeline-dot" [ngClass]="t.status"></div>
                    <div class="timeline-info">
                      <span class="timeline-title">{{ t.title }}</span>
                      <span class="timeline-desc">{{ t.description }}</span>
                      <span class="timeline-time">{{ t.timestamp | date:'short' }}</span>
                    </div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
      }
    }
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .header-action {
      display: flex;
      align-items: center;
      gap: $spacing-2;
      margin-bottom: $spacing-4;
    }

    .loader-box {
      @include flex-center;
      min-height: 250px;
    }

    .error-box {
      text-align: center;
      padding: $spacing-8 $spacing-4;
      background: $surface;
      border-radius: $radius-lg;
    }

    .details-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: $spacing-6;

      @include tablet-only {
        grid-template-columns: 1fr;
      }
    }

    .info-card, .control-card {
      border: 1px solid $border-light;
      box-shadow: $shadow-sm;
      background: $surface;
      margin-bottom: $spacing-4;
    }

    .sub-header {
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      color: $text-secondary;
      margin: $spacing-4 0 $spacing-2 0;
      border-bottom: 1px solid $border-light;
      padding-bottom: $spacing-1;
    }

    .description-text {
      font-size: $font-size-sm;
      color: $text-primary;
      line-height: 1.6;
      margin-bottom: $spacing-4;
    }

    .meta-row {
      display: flex;
      gap: $spacing-6;
      flex-wrap: wrap;

      .meta-item {
        @include flex-start;
        gap: $spacing-2;
        font-size: $font-size-xs;
        color: $text-secondary;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: $text-muted;
        }
      }
    }

    /* Images */
    .image-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: $spacing-3;
      margin-bottom: $spacing-4;

      .gallery-item {
        border-radius: $radius-md;
        overflow: hidden;
        border: 1px solid $border-light;
        height: 100px;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
    }

    .evidence-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: $spacing-4;

      @include mobile-only {
        grid-template-columns: 1fr;
      }
    }

    /* Notes */
    .notes-list {
      display: flex;
      flex-direction: column;
      gap: $spacing-3;
      margin-bottom: $spacing-4;
    }

    .note-item {
      padding: $spacing-3;
      background: rgba(255, 255, 255, 0.02);
      border-radius: $radius-md;
      border-left: 3px solid #6200ea;

      .note-header {
        @include flex-between;
        margin-bottom: $spacing-1;
        font-size: $font-size-xs;
      }

      .note-author {
        font-weight: $font-weight-semibold;
        color: $text-primary;
      }

      .note-time {
        color: $text-muted;
      }

      .note-text {
        font-size: $font-size-sm;
        color: $text-secondary;
        margin: 0;
      }
    }

    /* AI Widget */
    .ai-card {
      border: 1px solid rgba(0, 184, 212, 0.15);
      background: rgba(0, 184, 212, 0.02);
    }

    .ai-icon {
      color: #00b8d4;
      vertical-align: middle;
      margin-right: 4px;
    }

    .ai-widget {
      display: flex;
      flex-direction: column;
      gap: $spacing-3;
    }

    .ai-item {
      .ai-label {
        font-size: 10px;
        color: $text-muted;
        text-transform: uppercase;
        font-weight: $font-weight-semibold;
        display: block;
        margin-bottom: 4px;
      }

      .ai-row {
        display: flex;
        align-items: center;
        gap: $spacing-3;

        .confidence {
          font-size: 11px;
          color: #00b8d4;
          font-weight: $font-weight-semibold;
        }
      }

      .ai-text, .action-steps {
        font-size: $font-size-sm;
        color: $text-primary;
        margin: 0;
      }
    }

    .duplicate-alert {
      padding: $spacing-3;
      background: rgba(255, 61, 0, 0.08);
      border: 1px solid rgba(255, 61, 0, 0.15);
      border-radius: $radius-md;

      .alert-header {
        @include flex-start;
        gap: $spacing-2;
        color: #ff3d00;
        font-weight: $font-weight-semibold;
        font-size: $font-size-xs;
        margin-bottom: 4px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .alert-desc {
        font-size: 11px;
        color: $text-secondary;
        margin: 0;
      }
    }

    /* Controls */
    .control-content {
      display: flex;
      flex-direction: column;
      gap: $spacing-4;
    }

    .status-box {
      @include flex-between;
      border-bottom: 1px solid $border-light;
      padding-bottom: $spacing-3;

      .label {
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: $spacing-2;

      .label {
        font-size: $font-size-xs;
        color: $text-muted;
        font-weight: $font-weight-medium;
      }
    }

    /* Audit Timeline */
    .timeline {
      position: relative;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: $spacing-4;

      &::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: $border-light;
      }
    }

    .timeline-item {
      position: relative;
    }

    .timeline-dot {
      position: absolute;
      left: -20px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: $border;
      border: 2px solid $surface;

      &.submitted { background: #b3b3b3; }
      &.verified { background: #00b8d4; }
      &.assigned { background: #6200ea; }
      &.in_progress { background: #ffab00; }
      &.waiting { background: #ff3d00; }
      &.resolved { background: #00e676; }
      &.rejected { background: #ff3d00; }
      &.closed { background: #808080; }
    }

    .timeline-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .timeline-title {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $text-primary;
      }

      .timeline-desc {
        font-size: $font-size-xs;
        color: $text-secondary;
      }

      .timeline-time {
        font-size: 10px;
        color: $text-muted;
      }
    }

    .full-width {
      width: 100%;
    }

    .priority-tag {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;

      &.low { background: rgba(0, 230, 118, 0.1); color: #00e676; }
      &.medium { background: rgba(0, 184, 212, 0.1); color: #00b8d4; }
      &.high { background: rgba(255, 171, 0, 0.1); color: #ffab00; }
      &.critical { background: rgba(255, 61, 0, 0.1); color: #ff3d00; }
    }

    .status-tag {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 10px;

      &.submitted { background: rgba(255, 255, 255, 0.05); color: #b3b3b3; }
      &.verified { background: rgba(0, 184, 212, 0.1); color: #00b8d4; }
      &.assigned { background: rgba(98, 0, 234, 0.1); color: #6200ea; }
      &.in_progress { background: rgba(255, 171, 0, 0.1); color: #ffab00; }
      &.waiting { background: rgba(255, 61, 0, 0.1); color: #ff3d00; }
      &.resolved { background: rgba(0, 230, 118, 0.1); color: #00e676; }
      &.rejected { background: rgba(255, 61, 0, 0.15); color: #ff3d00; }
      &.closed { background: rgba(255, 255, 255, 0.1); color: #808080; }
    }

    .no-photos, .no-notes {
      font-size: $font-size-xs;
      color: $text-muted;
      font-style: italic;
      margin: 0;
    }
  `]
})
export class OfficerComplaintDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly officerService = inject(OfficerService);

  complaintId = '';
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  complaint = signal<Complaint | null>(null);
  availableWorkers = signal<any[]>([]);

  // Form controls
  selectedStatus = '';
  selectedWorker = '';
  noteText = '';
  resDescription = '';

  ngOnInit(): void {
    this.complaintId = this.route.snapshot.paramMap.get('id') || '';
    this.loadComplaint();
    this.loadWorkers();
  }

  loadComplaint(): void {
    this.loading.set(true);
    this.error.set(null);

    this.officerService.getComplaintDetails(this.complaintId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.complaint.set(res.data.complaint);
          this.selectedStatus = res.data.complaint.status;
          this.selectedWorker = res.data.complaint.assignment?.fieldWorker || '';
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to retrieve complaint logs details');
        this.loading.set(false);
      }
    });
  }

  loadWorkers(): void {
    this.officerService.getAvailableWorkers().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.availableWorkers.set(res.data.workers);
        }
      }
    });
  }

  getCitizenName(citizen: any): string {
    if (typeof citizen === 'object' && citizen !== null) {
      return `${citizen.firstName} ${citizen.lastName}`;
    }
    return 'Citizen Submitter';
  }

  onStatusChange(): void {
    if (!this.selectedStatus) return;
    this.officerService.transitionStatus(
      this.complaintId,
      this.selectedStatus,
      'Manual transition',
      `State updated by dispatcher to ${this.selectedStatus}`
    ).subscribe({
      next: () => {
        this.loadComplaint();
      }
    });
  }

  assignWorker(): void {
    if (!this.selectedWorker) return;
    this.officerService.assignWorker(this.complaintId, this.selectedWorker, 'Crew dispatched to repair spot').subscribe({
      next: () => {
        this.loadComplaint();
      }
    });
  }

  addInternalNote(): void {
    if (!this.noteText.trim()) return;
    this.officerService.addInternalNote(this.complaintId, this.noteText.trim()).subscribe({
      next: () => {
        this.noteText = '';
        this.loadComplaint();
      }
    });
  }

  submitResolution(): void {
    if (!this.resDescription.trim()) return;
    this.officerService.submitResolution(this.complaintId, this.resDescription.trim(), 'Resolved by dispatcher').subscribe({
      next: () => {
        this.resDescription = '';
        this.loadComplaint();
      }
    });
  }
}
