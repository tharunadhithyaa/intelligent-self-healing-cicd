import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OfficerService } from '../../../../core/services/officer.service';
import { Complaint } from '../../../../core/models/complaint.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-officer-complaints-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    PageHeaderComponent
  ],
  template: `
    <app-page-header
      title="Incident Roster & Dispatch"
      subtitle="View, verify, and delegate complaints to active field workers"
    />

    <!-- Filter Actions Bar -->
    <mat-card class="filter-card">
      <div class="filter-grid">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search issues...</mat-label>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="onFilterChange()" placeholder="Search by ID, title, citizen..." />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Workflow Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (selectionChange)="onFilterChange()">
            <mat-option value="">All Statuses</mat-option>
            <mat-option value="submitted">Submitted</mat-option>
            <mat-option value="verified">Verified</mat-option>
            <mat-option value="assigned">Assigned</mat-option>
            <mat-option value="in_progress">In Progress</mat-option>
            <mat-option value="waiting">Waiting</mat-option>
            <mat-option value="resolved">Resolved</mat-option>
            <mat-option value="rejected">Rejected</mat-option>
            <mat-option value="closed">Closed</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Severity Priority</mat-label>
          <mat-select [(ngModel)]="priorityFilter" (selectionChange)="onFilterChange()">
            <mat-option value="">All Priorities</mat-option>
            <mat-option value="low">Low</mat-option>
            <mat-option value="medium">Medium</mat-option>
            <mat-option value="high">High</mat-option>
            <mat-option value="critical">Critical</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Field Worker</mat-label>
          <mat-select [(ngModel)]="workerFilter" (selectionChange)="onFilterChange()">
            <mat-option value="">All Workers</mat-option>
            @for (w of availableWorkers(); track w._id) {
              <mat-option [value]="w._id">{{ w.firstName }} {{ w.lastName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sort By</mat-label>
          <mat-select [(ngModel)]="sortBy" (selectionChange)="onFilterChange()">
            <mat-option value="latest">Latest Submitted</mat-option>
            <mat-option value="priority">Priority Severity</mat-option>
            <mat-option value="status">Workflow Status</mat-option>
            <mat-option value="assignmentDate">Assignment Date</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </mat-card>

    <!-- Bulk Actions Panel -->
    @if (selectedIds().size > 0) {
      <mat-card class="bulk-card">
        <div class="bulk-content">
          <span class="selected-text">{{ selectedIds().size }} complaints selected</span>
          
          <div class="bulk-operations">
            <!-- Status Update -->
            <mat-form-field appearance="outline" class="compact-select">
              <mat-label>Bulk Status</mat-label>
              <mat-select [(ngModel)]="bulkStatus">
                <mat-option value="verified">Verified</mat-option>
                <mat-option value="rejected">Rejected</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!bulkStatus || bulkLoading()" (click)="applyBulkStatus()">
              Apply Status
            </button>

            <span class="divider">|</span>

            <!-- Assign worker -->
            <mat-form-field appearance="outline" class="compact-select">
              <mat-label>Bulk Worker</mat-label>
              <mat-select [(ngModel)]="bulkWorker">
                @for (w of availableWorkers(); track w._id) {
                  <mat-option [value]="w._id">{{ w.firstName }} {{ w.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!bulkWorker || bulkLoading()" (click)="applyBulkAssignment()">
              Assign Workers
            </button>
          </div>
        </div>
        @if (bulkLoading()) {
          <div class="bulk-progress">
            <mat-progress-spinner mode="indeterminate" diameter="20"></mat-progress-spinner>
            <span>Applying bulk edits...</span>
          </div>
        }
      </mat-card>
    }

    <!-- Complaints Grid Table -->
    @if (loading()) {
      <div class="loader-box">
        <mat-progress-spinner mode="indeterminate" diameter="45"></mat-progress-spinner>
      </div>
    } @else if (complaints().length === 0) {
      <div class="empty-state">
        <mat-icon class="empty-icon">assignment_late</mat-icon>
        <h3>No complaints found</h3>
        <p>Try refining your search queries or priority/status filters.</p>
      </div>
    } @else {
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th width="40">
                <mat-checkbox
                  [checked]="allSelected()"
                  [indeterminate]="someSelected()"
                  (change)="toggleSelectAll($event.checked)"
                />
              </th>
              <th>Incident Details</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Assigned Worker</th>
              <th>Status</th>
              <th width="100">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (c of complaints(); track c._id) {
              <tr [class.row-selected]="selectedIds().has(c._id)">
                <td>
                  <mat-checkbox
                    [checked]="selectedIds().has(c._id)"
                    (change)="toggleSelect(c._id, $event.checked)"
                  />
                </td>
                <td>
                  <div class="incident-cell">
                    <span class="incident-title">{{ c.title }}</span>
                    <span class="incident-sub">Address: {{ c.location.address }} • Date: {{ c.createdAt | date:'shortDate' }}</span>
                  </div>
                </td>
                <td>{{ c.category }}</td>
                <td>
                  <span class="priority-tag" [ngClass]="c.aiAnalysis?.priority || 'medium'">
                    {{ c.aiAnalysis?.priority?.toUpperCase() || 'MEDIUM' }}
                  </span>
                </td>
                <td>
                  @if (c.assignment?.fieldWorker) {
                    <span class="worker-name">{{ getWorkerName(c.assignment?.fieldWorker) }}</span>
                  } @else {
                    <span class="no-worker">Unassigned</span>
                  }
                </td>
                <td>
                  <span class="status-tag" [ngClass]="c.status">
                    {{ c.status.toUpperCase() }}
                  </span>
                </td>
                <td>
                  <a mat-stroked-button color="primary" [routerLink]="['/officer/complaints', c._id]">
                    Manage
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="pagination-footer">
        <span class="total-text">Showing {{ complaints().length }} of {{ totalCount() }} complaints</span>

        <div class="paginator-controls">
          <button mat-icon-button [disabled]="page() <= 1" (click)="prevPage()">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="page-num">Page {{ page() }} of {{ maxPages() }}</span>
          <button mat-icon-button [disabled]="page() >= maxPages()" (click)="nextPage()">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .filter-card {
      padding: $spacing-4;
      margin-bottom: $spacing-4;
      border: 1px solid $border-light;
      box-shadow: $shadow-sm;
      background: $surface;
    }

    .filter-grid {
      display: grid;
      grid-template-columns: 2fr repeat(4, 1fr);
      gap: $spacing-3;

      @include tablet-only {
        grid-template-columns: 1fr 1fr;
      }

      @include mobile-only {
        grid-template-columns: 1fr;
      }
    }

    /* Bulk Panel */
    .bulk-card {
      margin-bottom: $spacing-4;
      background: rgba(98, 0, 234, 0.05);
      border: 1px solid rgba(98, 0, 234, 0.15);
      padding: $spacing-3 $spacing-4;
    }

    .bulk-content {
      @include flex-between;
      flex-wrap: wrap;
      gap: $spacing-3;

      .selected-text {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: #6200ea;
      }
    }

    .bulk-operations {
      display: flex;
      align-items: center;
      gap: $spacing-3;
      flex-wrap: wrap;

      .compact-select {
        width: 140px;
        margin-bottom: -16px;
      }

      .divider {
        color: $border;
        font-weight: 300;
      }
    }

    .bulk-progress {
      @include flex-start;
      gap: $spacing-3;
      margin-top: $spacing-3;
      font-size: $font-size-xs;
      color: $text-secondary;
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
      margin-top: $spacing-4;

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: $text-muted;
        margin-bottom: $spacing-3;
      }
    }

    /* Data Table Layout */
    .table-container {
      overflow-x: auto;
      border: 1px solid $border-light;
      border-radius: $radius-lg;
      background: $surface;
      margin-top: $spacing-4;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: $font-size-sm;

      th, td {
        padding: $spacing-3 $spacing-4;
        border-bottom: 1px solid $border-light;
      }

      th {
        background: rgba(255, 255, 255, 0.02);
        color: $text-secondary;
        font-weight: $font-weight-semibold;
      }

      tr {
        transition: background $transition-fast;
        &:hover {
          background: rgba(255, 255, 255, 0.01);
        }
      }

      .row-selected {
        background: rgba(98, 0, 234, 0.02) !important;
      }
    }

    .incident-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .incident-title {
        font-weight: $font-weight-semibold;
        color: $text-primary;
      }
      .incident-sub {
        font-size: $font-size-xs;
        color: $text-muted;
      }
    }

    /* Tags styling */
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

    .no-worker {
      color: $text-muted;
      font-style: italic;
    }

    /* Paginator footer */
    .pagination-footer {
      @include flex-between;
      margin-top: $spacing-4;
      padding: 0 $spacing-2;

      .total-text {
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }

    .paginator-controls {
      display: flex;
      align-items: center;
      gap: $spacing-3;

      .page-num {
        font-size: $font-size-xs;
        color: $text-primary;
        font-weight: $font-weight-medium;
      }
    }
  `]
})
export class OfficerComplaintsListComponent implements OnInit {
  private readonly officerService = inject(OfficerService);

  loading = signal<boolean>(true);
  complaints = signal<Complaint[]>([]);
  totalCount = signal<number>(0);
  page = signal<number>(1);
  limit = 10;

  availableWorkers = signal<any[]>([]);

  // Search and filters
  searchQuery = '';
  statusFilter = '';
  priorityFilter = '';
  workerFilter = '';
  sortBy = 'latest';

  // Selection
  selectedIds = signal<Set<string>>(new Set());

  // Bulk parameters
  bulkStatus = '';
  bulkWorker = '';
  bulkLoading = signal<boolean>(false);

  maxPages = computed(() => Math.ceil(this.totalCount() / this.limit) || 1);

  allSelected = computed(() => {
    const list = this.complaints();
    if (list.length === 0) return false;
    return list.every(c => this.selectedIds().has(c._id));
  });

  someSelected = computed(() => {
    const list = this.complaints();
    const selected = this.selectedIds();
    const count = list.filter(c => selected.has(c._id)).length;
    return count > 0 && count < list.length;
  });

  ngOnInit(): void {
    this.loadComplaints();
    this.loadWorkers();
  }

  loadComplaints(): void {
    this.loading.set(true);
    const params: Record<string, any> = {
      page: this.page(),
      limit: this.limit,
      sortBy: this.sortBy
    };

    if (this.searchQuery) params['search'] = this.searchQuery;
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.priorityFilter) params['priority'] = this.priorityFilter;
    if (this.workerFilter) params['assignedWorker'] = this.workerFilter;

    this.officerService.getComplaints(params).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.complaints.set(res.data.complaints);
          this.totalCount.set(res.data.total);
        }
        this.loading.set(false);
      },
      error: () => {
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

  onFilterChange(): void {
    this.page.set(1);
    this.selectedIds.update(set => {
      set.clear();
      return set;
    });
    this.loadComplaints();
  }

  getWorkerName(workerId: any): string {
    if (typeof workerId === 'object' && workerId !== null) {
      return `${workerId.firstName} ${workerId.lastName}`;
    }
    const found = this.availableWorkers().find(w => w._id === workerId);
    return found ? `${found.firstName} ${found.lastName}` : 'Assigned Crew';
  }

  toggleSelect(id: string, checked: boolean): void {
    this.selectedIds.update(set => {
      if (checked) {
        set.add(id);
      } else {
        set.delete(id);
      }
      return new Set(set);
    });
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.update(set => {
      if (checked) {
        this.complaints().forEach(c => set.add(c._id));
      } else {
        this.complaints().forEach(c => set.delete(c._id));
      }
      return new Set(set);
    });
  }

  applyBulkStatus(): void {
    if (!this.bulkStatus || this.selectedIds().size === 0) return;
    this.bulkLoading.set(true);

    const ids = Array.from(this.selectedIds());
    const observables = ids.map(id =>
      this.officerService.transitionStatus(id, this.bulkStatus, 'Bulk Status Update', 'Updated via dispatcher board')
    );

    forkJoin(observables).subscribe({
      next: () => {
        this.selectedIds.update(set => {
          set.clear();
          return set;
        });
        this.bulkStatus = '';
        this.bulkLoading.set(false);
        this.loadComplaints();
      },
      error: () => {
        this.bulkLoading.set(false);
      }
    });
  }

  applyBulkAssignment(): void {
    if (!this.bulkWorker || this.selectedIds().size === 0) return;
    this.bulkLoading.set(true);

    const ids = Array.from(this.selectedIds());
    const observables = ids.map(id =>
      this.officerService.assignWorker(id, this.bulkWorker, 'Bulk reallocated via control board')
    );

    forkJoin(observables).subscribe({
      next: () => {
        this.selectedIds.update(set => {
          set.clear();
          return set;
        });
        this.bulkWorker = '';
        this.bulkLoading.set(false);
        this.loadComplaints();
      },
      error: () => {
        this.bulkLoading.set(false);
      }
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadComplaints();
    }
  }

  nextPage(): void {
    if (this.page() < this.maxPages()) {
      this.page.update(p => p + 1);
      this.loadComplaints();
    }
  }
}
