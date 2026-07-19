import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ComplaintsService } from '../../../../core/services/complaints.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { Complaint } from '../../../../core/models/complaint.model';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';

@Component({
  selector: 'app-complaint-details',
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    DatePipe,
    UpperCasePipe
  ],
  template: `
    <div class="details-page animate-fade-in-up">
      @if (loading()) {
        <div class="loading-state">
          <mat-progress-spinner mode="indeterminate" diameter="48"></mat-progress-spinner>
          <p>Fetching incident details and timeline records...</p>
        </div>
      } @else if (complaint()) {
        @let item = complaint()!;
        <app-page-header
          [title]="'Ticket: ' + item.title"
          [subtitle]="'Category: ' + item.category + ' | Submitted on ' + (item.date | date:'mediumDate')"
          icon="description"
        >
          <button mat-stroked-button [routerLink]="['/', paths.complaints.root]" class="header-action-btn">
            <mat-icon>chevron_left</mat-icon> Back to List
          </button>
        </app-page-header>

        <div class="details-grid">
          <!-- Left Column: Details, Location, Images -->
          <div class="details-col">
            <!-- Summary Information Card -->
            <mat-card class="details-card">
              <div class="details-card__header">
                <h3>Incident Information</h3>
                <span class="status-badge" [class]="item.status">
                  {{ getStatusLabel(item.status) }}
                </span>
              </div>
              <div class="details-card__body">
                <div class="info-group">
                  <span class="label">Title</span>
                  <p class="value">{{ item.title }}</p>
                </div>
                <div class="info-group">
                  <span class="label">Detailed Description</span>
                  <p class="value desc-text">{{ item.description }}</p>
                </div>

                <div class="info-row">
                  <div class="info-group">
                    <span class="label">Category</span>
                    <p class="value">
                      <mat-icon class="icon">category</mat-icon>
                      {{ item.category }}
                    </p>
                  </div>
                  <div class="info-group">
                    <span class="label">Location</span>
                    <p class="value">
                      <mat-icon class="icon">location_on</mat-icon>
                      {{ item.location.address }}
                    </p>
                  </div>
                </div>
              </div>
            </mat-card>

            <!-- AI Insights Card -->
            @if (item.aiAnalysis) {
              <mat-card class="details-card ai-insights">
                <div class="details-card__header">
                  <h3>AI Copilot Assessment</h3>
                  <mat-icon class="ai-icon">psychology</mat-icon>
                </div>
                <div class="details-card__body">
                  <div class="ai-metrics-row">
                    <div class="ai-metric">
                      <span class="label">Predicted Priority</span>
                      <strong class="priority-tag" [class]="item.aiAnalysis.priority">
                        {{ item.aiAnalysis.priority | uppercase }}
                      </strong>
                    </div>
                    <div class="ai-metric">
                      <span class="label">Recommended Dept</span>
                      <strong>{{ item.aiAnalysis.department }}</strong>
                    </div>
                    <div class="ai-metric">
                      <span class="label">Confidence Score</span>
                      <strong>{{ item.aiAnalysis.confidenceScore }}%</strong>
                    </div>
                  </div>
                  <div class="ai-summary">
                    <span class="label">Auto-Generated Incident Summary</span>
                    <p class="summary-text"><em>"{{ item.aiAnalysis.summary }}"</em></p>
                  </div>
                </div>
              </mat-card>
            }

            <!-- Uploaded Images Gallery -->
            @if (item.images && item.images.length > 0) {
              <mat-card class="details-card">
                <div class="details-card__header">
                  <h3>Attached Supporting Media ({{ item.images.length }})</h3>
                </div>
                <div class="details-card__body">
                  <div class="gallery-grid">
                    @for (img of item.images; track img.fileName; let idx = $index) {
                      <div class="gallery-tile" (click)="selectImage(img.base64Data)">
                        <img [src]="img.base64Data" [alt]="img.fileName" />
                      </div>
                    }
                  </div>
                </div>
              </mat-card>
            }
          </div>

          <!-- Right Column: Timeline Tracking and Officer Notes -->
          <div class="details-col">
            <!-- Timeline Tracker Card -->
            <mat-card class="details-card">
              <div class="details-card__header">
                <h3>Resolution Timeline</h3>
                <mat-icon>track_changes</mat-icon>
              </div>
              <div class="details-card__body">
                <div class="timeline">
                  @for (t of item.timeline; track t.timestamp; let last = $last) {
                    <div class="timeline-item">
                      <div class="timeline-dot" [class]="t.status">
                        <mat-icon>{{ getTimelineIcon(t.status) }}</mat-icon>
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-header">
                          <span class="timeline-title">{{ t.title }}</span>
                          <span class="timeline-date">{{ t.timestamp | date:'short' }}</span>
                        </div>
                        <p class="timeline-desc">{{ t.description }}</p>
                      </div>
                      @if (!last) {
                        <div class="timeline-line"></div>
                      }
                    </div>
                  }
                </div>
              </div>
            </mat-card>

            <!-- Officer Notes Card -->
            @if (item.assignment) {
              <mat-card class="details-card officer-card">
                <div class="details-card__header">
                  <h3>Assigned Officer & Resolution Notes</h3>
                  <mat-icon>shield</mat-icon>
                </div>
                <div class="details-card__body">
                  <div class="info-group">
                    <span class="label">Assigned Representative</span>
                    <p class="value">
                      <strong>{{ item.assignment.officer ? 'Officer Assigned' : 'Awaiting Assignment' }}</strong>
                      @if (item.assignment.assignedAt) {
                        <span class="assigned-date"> (Assigned on {{ item.assignment.assignedAt | date:'mediumDate' }})</span>
                      }
                    </p>
                  </div>

                  @if (item.assignment.officerNotes) {
                    <div class="notes-box">
                      <span class="label">Officer Assessment Notes</span>
                      <p class="notes-text">{{ item.assignment.officerNotes }}</p>
                    </div>
                  }

                  @if (item.assignment.resolutionUpdates) {
                    <div class="notes-box success">
                      <span class="label">Official Resolution Feedback</span>
                      <p class="notes-text">{{ item.assignment.resolutionUpdates }}</p>
                    </div>
                  } @else if (item.status === 'resolved' || item.status === 'closed') {
                    <div class="notes-box success">
                      <span class="label">Resolution</span>
                      <p class="notes-text">This incident has been resolved by our service team.</p>
                    </div>
                  }
                </div>
              </mat-card>
            }
          </div>
        </div>
      } @else {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <p>Failed to find or retrieve complaint details. It may have been deleted or moved.</p>
          <button mat-flat-button color="primary" [routerLink]="['/', paths.complaints.root]">
            Back to Complaints
          </button>
        </div>
      }

      <!-- Full-screen lightbox modal for image preview -->
      @if (selectedImage()) {
        <div class="lightbox" (click)="closeImage()">
          <div class="lightbox__content" (click)="$event.stopPropagation()">
            <img [src]="selectedImage()" alt="Enlarged view" />
            <button class="close-btn" mat-icon-button (click)="closeImage()" aria-label="Close image">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .details-page {
      display: flex;
      flex-direction: column;
    }

    .header-action-btn {
      @include flex-center;
      gap: $spacing-1;
    }

    // ─── Grid ───
    .details-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: $spacing-6;
      margin-top: $spacing-4;

      @include lg {
        grid-template-columns: 1.1fr 0.9fr;
      }
    }

    .details-col {
      display: flex;
      flex-direction: column;
      gap: $spacing-6;
    }

    .details-card {
      @include card-base;
      border: 1px solid $border;
      padding: $spacing-5 $spacing-6;

      &__header {
        @include flex-between;
        margin-bottom: $spacing-4;
        border-bottom: 1px solid $border-light;
        padding-bottom: $spacing-3;

        h3 {
          font-size: $font-size-base;
          font-weight: $font-weight-bold;
          color: $text-primary;
        }

        mat-icon {
          color: $primary;
        }
      }
    }

    // ─── Info elements ───
    .info-group {
      margin-bottom: $spacing-4;

      &:last-child {
        margin-bottom: 0;
      }

      .label {
        display: block;
        font-size: $font-size-xs;
        color: $text-secondary;
        font-weight: $font-weight-medium;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .value {
        font-size: $font-size-base;
        color: $text-primary;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 6px;

        .icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: $primary;
        }
      }

      .desc-text {
        line-height: $line-height-relaxed;
        white-space: pre-line;
      }
    }

    .info-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: $spacing-4;
      margin-top: $spacing-4;

      @include sm {
        grid-template-columns: 1fr 1fr;
      }
    }

    // ─── AI Assessment ───
    .ai-insights {
      background: linear-gradient(135deg, rgba($primary, 0.03) 0%, rgba($info, 0.03) 100%);
      border-color: rgba($primary, 0.15);

      .ai-icon {
        color: $primary;
      }
    }

    .ai-metrics-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: $spacing-4;
      margin-bottom: $spacing-5;

      @include sm {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .ai-metric {
      @include flex-column;
      gap: 2px;

      .label {
        font-size: 10px;
        color: $text-secondary;
        text-transform: uppercase;
        font-weight: $font-weight-semibold;
      }

      strong {
        font-size: $font-size-sm;
        color: $text-primary;
      }

      .priority-tag {
        display: inline-block;
        font-size: 10px;
        padding: 2px $spacing-2;
        border-radius: $radius-sm;
        width: fit-content;

        &.low { background: $primary-light; color: $primary-dark; }
        &.medium { background: $warning-light; color: $warning; }
        &.high { background: #FEE2E2; color: $danger; }
        &.critical { background: #7F1D1D; color: $text-inverse; }
      }
    }

    .ai-summary {
      .label {
        display: block;
        font-size: 10px;
        color: $text-secondary;
        text-transform: uppercase;
        font-weight: $font-weight-bold;
        margin-bottom: 4px;
      }

      .summary-text {
        font-size: $font-size-sm;
        color: $text-primary;
        margin: 0;
        line-height: $line-height-normal;
      }
    }

    // ─── Image Gallery ───
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: $spacing-4;
    }

    .gallery-tile {
      aspect-ratio: 1;
      border-radius: $radius-md;
      overflow: hidden;
      border: 1px solid $border;
      cursor: pointer;
      box-shadow: $shadow-sm;
      transition: all $transition-fast;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      &:hover {
        transform: scale(1.05);
        box-shadow: $shadow-md;
      }
    }

    // ─── Status badges ───
    .status-badge {
      font-size: 10px;
      font-weight: $font-weight-bold;
      text-transform: uppercase;
      padding: 3px $spacing-2;
      border-radius: $radius-full;

      &.submitted { background-color: $warning-light; color: $warning; }
      &.ai_reviewed { background-color: $info-light; color: $info; }
      &.assigned { background-color: #EDE9FE; color: #8B5CF6; }
      &.in_progress { background-color: #ECFEFF; color: #0891B2; }
      &.resolved { background-color: #D1FAE5; color: #059669; }
      &.closed { background-color: #F1F5F9; color: #64748B; }
    }

    // ─── Vertical timeline tracking ───
    .timeline {
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: $spacing-4;
      position: relative;
      padding-bottom: $spacing-8;

      &:last-child {
        padding-bottom: 0;
      }
    }

    .timeline-dot {
      @include flex-center;
      width: 28px;
      height: 28px;
      border-radius: $radius-full;
      z-index: 2;
      flex-shrink: 0;
      box-shadow: $shadow-sm;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: $text-inverse;
      }

      &.submitted { background-color: $warning; }
      &.ai_reviewed { background-color: $info; }
      &.assigned { background-color: #8B5CF6; }
      &.in_progress { background-color: #0891B2; }
      &.resolved { background-color: #059669; }
      &.closed { background-color: #64748B; }
    }

    .timeline-line {
      position: absolute;
      top: 28px;
      left: 13px;
      bottom: -12px;
      width: 2px;
      background: $border;
      z-index: 1;
    }

    .timeline-content {
      flex: 1;
      min-width: 0;
      background: $background;
      padding: $spacing-3 $spacing-4;
      border-radius: $radius-md;
      border: 1px solid $border-light;
    }

    .timeline-header {
      @include flex-between;
      margin-bottom: 4px;
      gap: $spacing-4;

      @include mobile-only {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
    }

    .timeline-title {
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .timeline-date {
      font-size: 10px;
      color: $text-muted;
    }

    .timeline-desc {
      font-size: $font-size-xs;
      color: $text-secondary;
      margin: 0;
      line-height: $line-height-normal;
    }

    // ─── Officer Card ───
    .officer-card {
      border-left: 4px solid $primary;

      .assigned-date {
        font-weight: $font-weight-regular;
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }

    .notes-box {
      margin-top: $spacing-4;
      padding: $spacing-4;
      border-radius: $radius-md;
      background: $background;
      border: 1px solid $border;

      .label {
        display: block;
        font-size: 10px;
        font-weight: $font-weight-bold;
        color: $text-secondary;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .notes-text {
        font-size: $font-size-sm;
        color: $text-primary;
        margin: 0;
        line-height: $line-height-normal;
      }

      &.success {
        background: #ECFDF5;
        border-color: rgba($success, 0.15);
        
        .label {
          color: $primary-dark;
        }
      }
    }

    // ─── Loading state ───
    .loading-state {
      @include flex-column-center;
      padding: $spacing-20 $spacing-4;
      color: $text-secondary;
      gap: $spacing-4;
    }

    // ─── Error State ───
    .error-state {
      @include flex-column-center;
      padding: $spacing-16 $spacing-4;
      color: $text-secondary;
      gap: $spacing-4;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: $danger;
      }
    }

    // ─── Lightbox Modal ───
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: $z-modal;
      @include flex-center;
      animation: fadeIn 0.2s ease;

      &__content {
        position: relative;
        max-width: 90%;
        max-height: 90%;

        img {
          max-width: 100%;
          max-height: 90vh;
          border-radius: $radius-md;
          box-shadow: $shadow-xl;
        }

        .close-btn {
          position: absolute;
          top: -$spacing-10;
          right: -$spacing-2;
          color: $text-inverse;
        }
      }
    }
  `],
})
export class ComplaintDetailsComponent implements OnInit {
  readonly paths = ROUTE_PATHS;
  private readonly route = inject(ActivatedRoute);
  private readonly complaintsService = inject(ComplaintsService);

  readonly complaint = signal<Complaint | null>(null);
  readonly loading = signal(true);
  readonly selectedImage = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.fetchDetails(id);
    } else {
      this.loading.set(false);
    }
  }

  fetchDetails(id: string): void {
    this.loading.set(true);
    this.complaintsService.getComplaintById(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data?.complaint) {
          this.complaint.set(res.data.complaint);
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error fetching complaint details:', err);
      }
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'submitted': return 'Submitted';
      case 'ai_reviewed': return 'AI Reviewed';
      case 'assigned': return 'Assigned';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  }

  getTimelineIcon(status: string): string {
    switch (status) {
      case 'submitted': return 'send';
      case 'ai_reviewed': return 'psychology';
      case 'assigned': return 'person_search';
      case 'in_progress': return 'construction';
      case 'resolved': return 'task_alt';
      case 'closed': return 'archive';
      default: return 'radio_button_checked';
    }
  }

  selectImage(base64: string | undefined): void {
    if (base64) {
      this.selectedImage.set(base64);
    }
  }

  closeImage(): void {
    this.selectedImage.set(null);
  }
}
