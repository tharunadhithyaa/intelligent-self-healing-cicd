import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../core/services/admin.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ChartComponent, ChartDataPoint } from '../../../../shared/components/chart/chart.component';
import { OverviewStats, MonthlyTrend, AIAccuracyMetrics, HeatmapItem } from '../../../../core/models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    ChartComponent
  ],
  template: `
    <div class="admin-dashboard-container animate-fade-in-up">
      <app-page-header title="Platform Control Center" subtitle="Real-time system health, AI classifications, and resource allocations."></app-page-header>

      @if (loading()) {
        <div class="loader-overlay">
          <mat-progress-spinner mode="indeterminate" diameter="50"></mat-progress-spinner>
        </div>
      } @else if (error()) {
        <div class="error-panel">
          <mat-icon>error_outline</mat-icon>
          <h3>Failed to Load Dashboard Data</h3>
          <p>{{ error() }}</p>
          <button mat-flat-button color="primary" (click)="loadData()">Retry Connection</button>
        </div>
      } @else {
        <!-- Grid Statistics Cards -->
        <div class="stats-grid">
          @for (card of statsCards(); track card.title) {
            <mat-card class="stat-card" [ngClass]="card.class">
              <mat-card-header>
                <div class="header-icon">
                  <mat-icon>{{ card.icon }}</mat-icon>
                </div>
                <div class="header-text">
                  <span class="card-label">{{ card.title }}</span>
                  <h2 class="card-value">{{ card.value }}</h2>
                </div>
              </mat-card-header>
            </mat-card>
          }
        </div>

        <!-- Charts Layout Section -->
        <div class="charts-layout">
          <!-- Complaint Volume Trends -->
          <mat-card class="chart-card line-trends">
            <mat-card-header>
              <mat-card-title>Monthly Complaint Trends</mat-card-title>
              <mat-card-subtitle>Historical ticket count vs resolved cases (past 6 months)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <app-chart type="line" [data]="trendData()" color="var(--primary-color)"></app-chart>
            </mat-card-content>
          </mat-card>

          <!-- AI Model Performance -->
          <mat-card class="chart-card ai-gauges">
            <mat-card-header>
              <mat-card-title>AI Classifier Diagnostics</mat-card-title>
              <mat-card-subtitle>Platform automation accuracy diagnostics</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="gauge-grid">
              <app-chart type="gauge" [value]="aiMetrics().categoryAccuracy" label="Category Precision" color="var(--accent-color)"></app-chart>
              <app-chart type="gauge" [value]="aiMetrics().priorityAccuracy" label="Priority Weights" color="#8bc34a"></app-chart>
              <app-chart type="gauge" [value]="aiMetrics().averageConfidence" label="Average Confidence" color="var(--primary-color)"></app-chart>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- GIS Coordinates Heatmap Block -->
        <mat-card class="heatmap-card">
          <mat-card-header>
            <mat-card-title>Spatial Incident Concentration Heatmap</mat-card-title>
            <mat-card-subtitle>Interactive location grid coordinates displaying cluster regions</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="gis-heatmap-wrapper">
              <div class="gis-grid-overlay">
                <!-- Heatmap density nodes -->
                @for (node of mapNodes(); track node.id) {
                  <div
                    class="heatmap-node animate-pulse"
                    [style.left.%]="node.x"
                    [style.top.%]="node.y"
                    [ngClass]="node.status"
                  >
                    <div class="node-tooltip">
                      <strong>{{ node.title }}</strong>
                      <div>Category: {{ node.category }}</div>
                      <div>Status: {{ node.status | uppercase }}</div>
                      <div class="addr">{{ node.address }}</div>
                    </div>
                  </div>
                }
              </div>
              <div class="heatmap-legend">
                <span class="legend-item"><span class="dot submitted"></span> Submitted</span>
                <span class="legend-item"><span class="dot in_progress"></span> In Progress</span>
                <span class="legend-item"><span class="dot resolved"></span> Resolved</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .admin-dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 32px;
    }

    .loader-overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 350px;
    }

    .error-panel {
      text-align: center;
      padding: 48px;
      background: rgba(244, 67, 54, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(244, 67, 54, 0.15);
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--warn-color);
        margin-bottom: 12px;
      }
      h3 {
        margin: 0 0 8px 0;
        font-weight: 700;
      }
      p {
        color: var(--text-secondary);
        margin: 0 0 16px 0;
      }
    }

    /* Stats Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
      }
      mat-card-header {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .header-icon {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.04);
        mat-icon {
          color: var(--primary-color);
        }
      }
      .header-text {
        display: flex;
        flex-direction: column;
      }
      .card-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.5px;
      }
      .card-value {
        font-size: 24px;
        font-weight: 800;
        margin: 4px 0 0 0;
        line-height: 1;
        letter-spacing: -0.5px;
      }

      &.primary .header-icon {
        background: rgba(98, 0, 234, 0.15);
        mat-icon { color: var(--primary-color); }
      }
      &.accent .header-icon {
        background: rgba(0, 184, 212, 0.15);
        mat-icon { color: var(--accent-color); }
      }
      &.warn .header-icon {
        background: rgba(255, 61, 0, 0.15);
        mat-icon { color: var(--warn-color); }
      }
      &.success .header-icon {
        background: rgba(76, 175, 80, 0.15);
        mat-icon { color: #4caf50; }
      }
    }

    /* Charts Layout */
    .charts-layout {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 20px;
      @media (max-width: 959px) {
        grid-template-columns: 1fr;
      }
    }

    .chart-card {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      mat-card-header {
        padding: 20px 20px 8px 20px;
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

    .gauge-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      height: 100%;
      align-items: center;
    }

    /* Heatmap Layout */
    .heatmap-card {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      mat-card-header {
        padding: 20px 20px 8px 20px;
      }
      mat-card-title {
        font-size: 16px;
        font-weight: 700;
      }
      mat-card-content {
        padding: 20px;
      }
    }

    .gis-heatmap-wrapper {
      position: relative;
      width: 100%;
      height: 320px;
      background: radial-gradient(circle at center, rgba(18, 18, 18, 0.9) 0%, rgba(10, 10, 10, 0.95) 100%);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
      box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8);
    }

    .gis-grid-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-size: 20px 20px;
      background-image:
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    }

    .heatmap-node {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 0 10px currentColor;

      &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--surface);
      }

      &.submitted {
        color: var(--primary-color);
        background: rgba(98, 0, 234, 0.4);
      }
      &.in_progress, &.assigned, &.ai_reviewed {
        color: var(--accent-color);
        background: rgba(0, 184, 212, 0.4);
      }
      &.resolved {
        color: #4caf50;
        background: rgba(76, 175, 80, 0.4);
      }

      &:hover {
        transform: translate(-50%, -50%) scale(1.4);
        z-index: 10;
        .node-tooltip {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, -105%) scale(1);
        }
      }
    }

    .node-tooltip {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translate(-50%, -90%) scale(0.95);
      opacity: 0;
      pointer-events: none;
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 11px;
      color: var(--text-primary);
      width: 180px;
      z-index: 20;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      strong {
        display: block;
        margin-bottom: 4px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .addr {
        color: var(--text-secondary);
        margin-top: 4px;
        font-size: 9px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .heatmap-legend {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 12px;
      border-radius: 6px;
      display: flex;
      gap: 12px;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-primary);
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
        &.submitted { background: var(--primary-color); }
        &.in_progress { background: var(--accent-color); }
        &.resolved { background: #4caf50; }
      }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Platform counters
  stats = signal<OverviewStats | null>(null);

  // Analytics Trends
  trends = signal<MonthlyTrend[]>([]);
  aiMetrics = signal<AIAccuracyMetrics>({
    categoryAccuracy: 92,
    priorityAccuracy: 87,
    duplicatePerformance: 95,
    averageConfidence: 89
  });

  // Spatial coordinates
  heatmap = signal<HeatmapItem[]>([]);

  statsCards = computed(() => {
    const s = this.stats();
    if (!s) return [];

    return [
      { title: 'Total Citizens', value: s.totalUsers, icon: 'people', class: 'primary' },
      { title: 'Total Complaints', value: s.totalComplaints, icon: 'receipt_long', class: 'accent' },
      { title: 'Pending Audit', value: s.pendingComplaints, icon: 'pending_actions', class: 'warn' },
      { title: 'Cases Resolved', value: s.resolvedComplaints, icon: 'task_alt', class: 'success' },
      { title: 'Departments', value: s.totalDepartments, icon: 'business', class: 'primary' },
      { title: 'Active Officers', value: s.totalOfficers, icon: 'admin_panel_settings', class: 'accent' },
      { title: 'Field Workers', value: s.totalFieldWorkers, icon: 'engineering', class: 'success' }
    ];
  });

  trendData = computed<ChartDataPoint[]>(() => {
    return this.trends().map(t => ({
      label: t.month,
      value: t.count
    }));
  });

  mapNodes = computed(() => {
    // Project geographic coordinates into coordinate ranges (0 to 100%)
    return this.heatmap().map(h => {
      // Map arbitrary degrees to grid percent (simulated project scale)
      // Latitudes roughly 10-20, Longitudes roughly 70-80
      const x = Math.min(95, Math.max(5, ((h.longitude % 1) * 100)));
      const y = Math.min(95, Math.max(5, ((h.latitude % 1) * 100)));

      return {
        id: h.id,
        title: h.title,
        category: h.category,
        status: h.status,
        address: h.address,
        x,
        y
      };
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Call service operations in parallel
    this.adminService.getOverviewStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats.set(res.data.stats);
          this.loadAnalytics();
        }
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to communicate with administrative dashboard service');
        this.loading.set(false);
      }
    });
  }

  private loadAnalytics(): void {
    this.adminService.getAnalyticsOverview().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.trends.set(res.data.analytics.trends);
          this.aiMetrics.set(res.data.analytics.aiMetrics);
          this.heatmap.set(res.data.analytics.heatmap);
        }
        this.loading.set(false);
      },
      error: () => {
        // Fallback or finish loading safely
        this.loading.set(false);
      }
    });
  }
}
