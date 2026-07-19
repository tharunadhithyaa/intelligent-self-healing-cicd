import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ChartComponent, ChartDataPoint } from '../../../../shared/components/chart/chart.component';
import { AdminReportData } from '../../../../core/models/admin.model';

@Component({
  selector: 'app-report-generation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    ChartComponent
  ],
  template: `
    <div class="report-generation-container animate-fade-in-up">
      <app-page-header title="Audit Reports & Data Export" subtitle="Generate range-based platform summaries, inspect department productivity, and download secure CSV logs."></app-page-header>

      <div class="control-header">
        <div class="filters">
          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Timeframe Range</mat-label>
            <mat-select [(ngModel)]="timeframe" (selectionChange)="loadReport()">
              <mat-option value="daily">Daily Summary (Past 24h)</mat-option>
              <mat-option value="weekly">Weekly Logs (Past 7d)</mat-option>
              <mat-option value="monthly">Monthly Logs (Past 30d)</mat-option>
              <mat-option value="yearly">Yearly Audits (Past 12m)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="actions">
          <button mat-flat-button color="primary" (click)="exportCSV()" [disabled]="exporting() || loading()">
            @if (exporting()) {
              <mat-progress-spinner mode="indeterminate" diameter="18" style="display:inline-block; margin-right:8px"></mat-progress-spinner>
              Building CSV...
            } @else {
              <span><mat-icon style="display: inline-block; vertical-align: middle; margin-right: 4px; font-size: 18px; width: 18px; height: 18px;">download</mat-icon> Export CSV Summary</span>
            }
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loader-box">
          <mat-progress-spinner mode="indeterminate" diameter="45"></mat-progress-spinner>
        </div>
      } @else if (reportData()) {
        <!-- Report Metrics cards -->
        <div class="metrics-row">
          <mat-card class="metric-box">
            <span class="lbl">Total Incident Tickets</span>
            <h3>{{ reportData()?.summary?.totalComplaints }}</h3>
          </mat-card>
          <mat-card class="metric-box">
            <span class="lbl">Resolved Cases</span>
            <h3>{{ reportData()?.summary?.resolvedCount }}</h3>
          </mat-card>
          <mat-card class="metric-box">
            <span class="lbl">Avg. Resolution Duration</span>
            <h3>{{ reportData()?.summary?.avgResolutionHours }} hrs</h3>
          </mat-card>
          <mat-card class="metric-box">
            <span class="lbl">AI Avg. Confidence</span>
            <h3>{{ reportData()?.aiStats?.avgConfidence }}%</h3>
          </mat-card>
        </div>

        <div class="data-layout">
          <!-- Left side: Department breakdown table -->
          <mat-card class="data-card table-section">
            <mat-card-header>
              <mat-card-title>Department Roster Workloads</mat-card-title>
              <mat-card-subtitle>Assigned incidents, resolved files, and completion rates by agency</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th style="text-align: center">Assigned</th>
                    <th style="text-align: center">Resolved</th>
                    <th style="text-align: center">Pending</th>
                    <th style="text-align: right">Resolution Rate</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of reportData()?.departments; track d.name) {
                    <tr>
                      <td class="name">{{ d.name }}</td>
                      <td align="center">{{ d.total }}</td>
                      <td align="center">{{ d.resolved }}</td>
                      <td align="center" [ngClass]="{'has-load': d.pending > 0}">{{ d.pending }}</td>
                      <td align="right" class="rate">{{ d.resolutionRate }}%</td>
                    </tr>
                  }
                </tbody>
              </table>
            </mat-card-content>
          </mat-card>

          <!-- Right side: Workloads visualizer -->
          <mat-card class="data-card chart-section">
            <mat-card-header>
              <mat-card-title>Incident Distribution Chart</mat-card-title>
              <mat-card-subtitle>Total incident tickets mapped by agency allocations</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (chartPoints().length === 0) {
                <div class="empty-chart">No workloads mapped for chart visualization</div>
              } @else {
                <app-chart type="bar" [data]="chartPoints()" color="var(--accent-color)"></app-chart>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;

    .report-generation-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-bottom: 32px;
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px 20px;
      .filters {
        mat-form-field {
          margin: 0;
          width: 260px;
        }
      }
    }

    .loader-box {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 250px;
    }

    /* Summary Row */
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .metric-box {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      .lbl {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-secondary);
        letter-spacing: 0.5px;
      }
      h3 {
        font-size: 28px;
        font-weight: 800;
        margin: 8px 0 0 0;
        color: var(--primary-color);
        line-height: 1;
        letter-spacing: -0.5px;
      }
    }

    /* Data Layout */
    .data-layout {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 20px;
      align-items: start;
      @media (max-width: 959px) {
        grid-template-columns: 1fr;
      }
    }

    .data-card {
      background: var(--surface-card);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      mat-card-header {
        padding: 20px 20px 8px 20px;
      }
      mat-card-title {
        font-size: 15px;
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

    /* Table styling */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      th {
        padding: 10px;
        color: var(--text-secondary);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-weight: 600;
      }
      td {
        padding: 12px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        &.name {
          font-weight: 600;
          color: var(--text-primary);
        }
        &.rate {
          font-weight: 700;
          color: var(--primary-color);
        }
        &.has-load {
          color: var(--accent-color);
          font-weight: 600;
        }
      }
    }

    .empty-chart {
      text-align: center;
      padding: 60px 0;
      color: var(--text-secondary);
      font-style: italic;
    }
  `]
})
export class ReportGenerationComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly notificationService = inject(NotificationService);

  loading = signal<boolean>(true);
  exporting = signal<boolean>(false);
  timeframe = signal<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  reportData = signal<AdminReportData | null>(null);

  chartPoints = computed<ChartDataPoint[]>(() => {
    const r = this.reportData();
    if (!r || !r.departments) return [];

    return r.departments.map(d => ({
      label: d.name,
      value: d.total
    }));
  });

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.adminService.generateReport(this.timeframe()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.reportData.set(res.data.report);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Failed to generate summary report');
        this.loading.set(false);
      }
    });
  }

  exportCSV(): void {
    this.exporting.set(true);
    const range = this.timeframe();

    this.adminService.exportReportCSV(range).subscribe({
      next: (blob) => {
        // Trigger browser file download securely
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `civicpulse-report-${range}-${new Date().toISOString().substring(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.notificationService.success('CSV Report successfully downloaded');
        this.exporting.set(false);
      },
      error: () => {
        this.notificationService.error('Failed to export CSV report');
        this.exporting.set(false);
      }
    });
  }
}
