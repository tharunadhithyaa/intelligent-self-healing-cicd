import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ComplaintsService } from '../../../../core/services/complaints.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { Complaint, COMPLAINT_CATEGORIES } from '../../../../core/models/complaint.model';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';

@Component({
  selector: 'app-complaint-list',
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    PageHeaderComponent,
    EmptyStateComponent,
    DatePipe,
    UpperCasePipe,
  ],
  template: `
    <div class="list-page animate-fade-in-up">
      <app-page-header
        title="My Reported Issues"
        subtitle="Manage and track resolution progress for all complaints you have submitted."
        icon="assignment"
      >
        <button
          mat-flat-button
          color="primary"
          [routerLink]="['/', paths.report]"
          class="header-action-btn"
        >
          <mat-icon>add_circle</mat-icon> Report Issue
        </button>
      </app-page-header>

      <!-- Filters -->
      <div class="filters">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Status Filter</mat-label>
          <mat-select [value]="statusFilter()" (selectionChange)="updateStatusFilter($event.value)">
            <mat-option value="all">All Statuses</mat-option>
            <mat-option value="submitted">Submitted</mat-option>
            <mat-option value="ai_reviewed">AI Reviewed</mat-option>
            <mat-option value="assigned">Assigned</mat-option>
            <mat-option value="in_progress">In Progress</mat-option>
            <mat-option value="resolved">Resolved</mat-option>
            <mat-option value="closed">Closed</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Category Filter</mat-label>
          <mat-select
            [value]="categoryFilter()"
            (selectionChange)="updateCategoryFilter($event.value)"
          >
            <mat-option value="all">All Categories</mat-option>
            @for (cat of categories; track cat) {
              <mat-option [value]="cat">{{ cat }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-state">
          <mat-icon class="spinner">sync</mat-icon>
          <p>Fetching complaints list...</p>
        </div>
      } @else {
        <!-- Complaints Display -->
        @if (filteredComplaints().length === 0) {
          <div class="empty-container">
            <app-empty-state
              icon="assignment_late"
              title="No complaints found"
              description="No reports match your selected filters. Create a new ticket if you want to report a local civic issue."
            />
            <button mat-flat-button color="primary" [routerLink]="['/', paths.report]">
              <mat-icon>add</mat-icon> Submit New Complaint
            </button>
          </div>
        } @else {
          <div class="complaints-grid">
            @for (item of filteredComplaints(); track item._id) {
              <mat-card
                class="complaint-card"
                [routerLink]="['/', paths.complaints.root, item._id]"
              >
                <div class="complaint-card__header">
                  <span class="category-tag">{{ item.category }}</span>
                  <span class="status-badge" [class]="item.status">
                    {{ getStatusLabel(item.status) }}
                  </span>
                </div>

                <div class="complaint-card__body">
                  <h3 class="complaint-card__title">{{ item.title }}</h3>
                  <p class="complaint-card__description">{{ item.description }}</p>

                  <div class="complaint-card__meta">
                    <div class="meta-item">
                      <mat-icon>location_on</mat-icon>
                      <span>{{ item.location.address }}</span>
                    </div>
                    <div class="meta-item">
                      <mat-icon>calendar_today</mat-icon>
                      <span>{{ item.date | date: 'mediumDate' }}</span>
                    </div>
                  </div>
                </div>

                <div class="complaint-card__footer">
                  @if (item.aiAnalysis) {
                    <div class="ai-pill">
                      <mat-icon>psychology</mat-icon>
                      <span>AI Priority: {{ item.aiAnalysis.priority | uppercase }}</span>
                    </div>
                  }
                  <button mat-button class="view-btn">
                    Details <mat-icon>chevron_right</mat-icon>
                  </button>
                </div>
              </mat-card>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .list-page {
        display: flex;
        flex-direction: column;
      }

      .header-action-btn {
        @include flex-center;
        gap: $spacing-2;
      }

      // ─── Filters Row ───
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: $spacing-4;
        margin-bottom: $spacing-6;
        background: $surface;
        padding: $spacing-4;
        border-radius: $radius-lg;
        border: 1px solid $border;
      }

      .filter-field {
        flex: 1;
        min-width: 200px;
      }

      // ─── Loading state ───
      .loading-state {
        @include flex-column-center;
        padding: $spacing-12 $spacing-4;
        color: $text-secondary;
        gap: $spacing-3;

        .spinner {
          animation: spin 1.5s linear infinite;
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      // ─── Empty state adjustment ───
      .empty-container {
        @include flex-column-center;
        background: $surface;
        border-radius: $radius-xl;
        border: 1px solid $border;
        padding-bottom: $spacing-10;

        button {
          margin-top: -$spacing-4;
        }
      }

      // ─── Grid ───
      .complaints-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: $spacing-6;
      }

      .complaint-card {
        @include card-base;
        @include card-hover('.complaint-card');
        cursor: pointer;
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid $border;

        &__header {
          @include flex-between;
          padding: $spacing-4 $spacing-5;
          border-bottom: 1px solid $border-light;
        }

        &__body {
          padding: $spacing-5;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        &__title {
          font-size: $font-size-base;
          font-weight: $font-weight-bold;
          color: $text-primary;
          margin-bottom: $spacing-2;
          @include line-clamp(1);
        }

        &__description {
          font-size: $font-size-sm;
          color: $text-secondary;
          line-height: $line-height-normal;
          margin-bottom: $spacing-4;
          @include line-clamp(3);
        }

        &__meta {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: $spacing-2;
        }

        &__footer {
          @include flex-between;
          padding: $spacing-3 $spacing-5;
          border-top: 1px solid $border-light;
          background: $background;
          border-bottom-left-radius: $radius-lg;
          border-bottom-right-radius: $radius-lg;
        }
      }

      .category-tag {
        background: $primary-light;
        color: $primary-dark;
        padding: 2px $spacing-2;
        border-radius: $radius-sm;
        font-size: $font-size-xs;
        font-weight: $font-weight-semibold;
      }

      .status-badge {
        font-size: 10px;
        font-weight: $font-weight-bold;
        text-transform: uppercase;
        padding: 3px $spacing-2;
        border-radius: $radius-full;

        &.submitted {
          background-color: $warning-light;
          color: $warning;
        }
        &.ai_reviewed {
          background-color: $info-light;
          color: $info;
        }
        &.assigned {
          background-color: #ede9fe;
          color: #8b5cf6;
        }
        &.in_progress {
          background-color: #ecfeff;
          color: #0891b2;
        }
        &.resolved {
          background-color: #d1fae5;
          color: #059669;
        }
        &.closed {
          background-color: #f1f5f9;
          color: #64748b;
        }
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: $spacing-2;
        font-size: $font-size-xs;
        color: $text-secondary;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: $icon-secondary;
        }

        span {
          @include text-truncate;
        }
      }

      .ai-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: $font-weight-semibold;
        color: $primary-dark;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: $primary;
        }
      }

      .view-btn {
        color: $primary;
        font-size: $font-size-xs;
        font-weight: $font-weight-semibold;
        padding: 0;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ComplaintListComponent implements OnInit {
  readonly paths = ROUTE_PATHS;
  readonly categories = COMPLAINT_CATEGORIES;

  // Signal state
  readonly complaints = signal<Complaint[]>([]);
  readonly loading = signal(true);
  readonly statusFilter = signal<string>('all');
  readonly categoryFilter = signal<string>('all');

  private readonly complaintsService = inject(ComplaintsService);

  ngOnInit(): void {
    this.fetchComplaints();
  }

  fetchComplaints(): void {
    this.loading.set(true);
    this.complaintsService.getComplaints().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data?.complaints) {
          this.complaints.set(res.data.complaints);
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Error fetching complaints:', err);
      },
    });
  }

  updateStatusFilter(val: string): void {
    this.statusFilter.set(val);
  }

  updateCategoryFilter(val: string): void {
    this.categoryFilter.set(val);
  }

  // Filter complaints list dynamically using Signals
  readonly filteredComplaints = computed(() => {
    return this.complaints().filter((c) => {
      const matchStatus = this.statusFilter() === 'all' || c.status === this.statusFilter();
      const matchCategory = this.categoryFilter() === 'all' || c.category === this.categoryFilter();
      return matchStatus && matchCategory;
    });
  });

  getStatusLabel(status: string): string {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'ai_reviewed':
        return 'AI Reviewed';
      case 'assigned':
        return 'Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return status;
    }
  }
}
