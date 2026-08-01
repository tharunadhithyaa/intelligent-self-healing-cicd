import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OfficerService, OfficerStats, DeptStats } from '../../../../core/services/officer.service';
import {
  ChartComponent,
  ChartDataPoint,
} from '../../../../shared/components/chart/chart.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-officer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ChartComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      title="Operational Control Dashboard"
      subtitle="Overview of assigned incident workflows and department rosters"
    />

    @if (loading()) {
      <div class="loader-box">
        <mat-progress-spinner mode="indeterminate" diameter="50"></mat-progress-spinner>
      </div>
    } @else if (error()) {
      <div class="error-box">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <p>{{ error() }}</p>
        <button mat-flat-button color="primary" (click)="loadDashboard()">Retry</button>
      </div>
    } @else {
      <!-- Dashboard Overview Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card stat-card--primary">
          <mat-card-content>
            <div class="stat-card__header">
              <span class="stat-card__title">Assigned Active Jobs</span>
              <div class="stat-card__icon-box">
                <mat-icon>assignment_ind</mat-icon>
              </div>
            </div>
            <div class="stat-card__value">{{ stats()?.assigned || 0 }}</div>
            <div class="stat-card__footer">
              <span class="stat-card__desc">Assigned directly to you</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card stat-card--pending">
          <mat-card-content>
            <div class="stat-card__header">
              <span class="stat-card__title">Department Pending</span>
              <div class="stat-card__icon-box">
                <mat-icon>hourglass_empty</mat-icon>
              </div>
            </div>
            <div class="stat-card__value">{{ stats()?.pending || 0 }}</div>
            <div class="stat-card__footer">
              <span class="stat-card__desc">Submitted or verified</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card stat-card--warn">
          <mat-card-content>
            <div class="stat-card__header">
              <span class="stat-card__title">High Severity Issues</span>
              <div class="stat-card__icon-box">
                <mat-icon>gavel</mat-icon>
              </div>
            </div>
            <div class="stat-card__value">{{ stats()?.highPriority || 0 }}</div>
            <div class="stat-card__footer">
              <span class="stat-card__desc">Critical/high severity issues</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card stat-card--success">
          <mat-card-content>
            <div class="stat-card__header">
              <span class="stat-card__title">Resolved/Closed Tasks</span>
              <div class="stat-card__icon-box">
                <mat-icon>check_circle</mat-icon>
              </div>
            </div>
            <div class="stat-card__value">{{ stats()?.completed || 0 }}</div>
            <div class="stat-card__footer">
              <span class="stat-card__desc">Repairs completed successfully</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card stat-card--info">
          <mat-card-content>
            <div class="stat-card__header">
              <span class="stat-card__title">Average Dispatch Time</span>
              <div class="stat-card__icon-box">
                <mat-icon>speed</mat-icon>
              </div>
            </div>
            <div class="stat-card__value">{{ stats()?.averageResponseHours || 0 }}h</div>
            <div class="stat-card__footer">
              <span class="stat-card__desc">Incident verification metrics</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Department Performance and Visual Statistics -->
      <div class="dashboard-details">
        <mat-card class="details-card">
          <mat-card-header>
            <mat-card-title>Sanitation & Infrastructure workload</mat-card-title>
            <mat-card-subtitle>Current workload status count indicators</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-box">
              <app-chart [data]="workloadChartData()" type="bar" [height]="200" color="#6200ea" />
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="details-card">
          <mat-card-header>
            <mat-card-title>Resolution Efficiency</mat-card-title>
            <mat-card-subtitle>Overall percentage of solved tickets</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="efficiency-content">
            <div class="radial-box">
              <app-chart
                [data]="efficiencyChartData()"
                type="gauge"
                [height]="150"
                color="#00b8d4"
              />
            </div>
            <div class="efficiency-info">
              <h3>{{ deptStats()?.performanceRate || 0 }}%</h3>
              <p>Municipal cases resolved out of total assigned files</p>
              <button mat-stroked-button color="primary" routerLink="/officer/complaints">
                View All Files
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .loader-box {
        @include flex-center;
        min-height: 250px;
      }

      .error-box {
        text-align: center;
        padding: $spacing-8 $spacing-4;
        background: $surface;
        border-radius: $radius-lg;
        margin: $spacing-6 0;

        .error-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #ff3d00;
          margin-bottom: $spacing-4;
        }
      }

      /* Stats Grid Layout */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: $spacing-4;
        margin-bottom: $spacing-6;
      }

      .stat-card {
        position: relative;
        overflow: hidden;
        border: 1px solid $border-light;
        box-shadow: $shadow-sm;
        transition: transform $transition-fast;

        &:hover {
          transform: translateY(-2px);
        }

        &__header {
          @include flex-between;
          margin-bottom: $spacing-3;
        }

        &__title {
          font-size: $font-size-xs;
          color: $text-secondary;
          font-weight: $font-weight-medium;
        }

        &__icon-box {
          @include flex-center;
          width: 32px;
          height: 32px;
          border-radius: $radius-md;
          background: rgba(255, 255, 255, 0.05);

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        &__value {
          font-size: 28px;
          font-weight: $font-weight-bold;
          color: $text-primary;
          line-height: 1.2;
          margin-bottom: $spacing-2;
        }

        &__desc {
          font-size: $font-size-xs;
          color: $text-muted;
        }

        /* Roles-colored tags */
        &--primary &__icon-box {
          background: rgba(98, 0, 234, 0.1);
          color: #6200ea;
        }
        &--pending &__icon-box {
          background: rgba(255, 171, 0, 0.1);
          color: #ffab00;
        }
        &--warn &__icon-box {
          background: rgba(255, 61, 0, 0.1);
          color: #ff3d00;
        }
        &--success &__icon-box {
          background: rgba(0, 230, 118, 0.1);
          color: #00e676;
        }
        &--info &__icon-box {
          background: rgba(0, 184, 212, 0.1);
          color: #00b8d4;
        }
      }

      /* Details layouts */
      .dashboard-details {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: $spacing-6;

        @include tablet-only {
          grid-template-columns: 1fr;
        }
      }

      .details-card {
        border: 1px solid $border-light;
        box-shadow: $shadow-sm;
        background: $surface;

        mat-card-header {
          margin-bottom: $spacing-4;
        }
      }

      .chart-box {
        padding: $spacing-2;
      }

      .efficiency-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: $spacing-4;
        padding: $spacing-4 0;

        .radial-box {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .efficiency-info {
          h3 {
            font-size: 32px;
            font-weight: $font-weight-bold;
            margin: 0 0 $spacing-2 0;
            color: var(--primary-color, #6200ea);
          }
          p {
            font-size: $font-size-xs;
            color: $text-secondary;
            margin-bottom: $spacing-4;
            max-width: 220px;
          }
        }
      }
    `,
  ],
})
export class OfficerDashboardComponent implements OnInit {
  private readonly officerService = inject(OfficerService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  stats = signal<OfficerStats | null>(null);
  deptStats = signal<DeptStats | null>(null);

  workloadChartData = computed<ChartDataPoint[]>(() => {
    const s = this.deptStats();
    if (!s || !s.workload) return [];
    return [
      { label: 'Submitted', value: s.workload.submitted || 0 },
      { label: 'In Progress', value: s.workload.inProgress || 0 },
      { label: 'Waiting', value: s.workload.waiting || 0 },
      { label: 'Resolved', value: s.workload.resolved || 0 },
    ];
  });

  efficiencyChartData = computed<ChartDataPoint[]>(() => {
    const s = this.deptStats();
    if (!s) return [];
    return [{ label: 'Efficiency', value: s.performanceRate || 0 }];
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.officerService.getDashboardStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats.set(res.data.stats);
          this.loadDeptStats();
        }
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load officer control metrics');
        this.loading.set(false);
      },
    });
  }

  private loadDeptStats(): void {
    this.officerService.getDepartmentStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.deptStats.set(res.data.stats);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
