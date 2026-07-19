import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/services/auth.service';
import { ComplaintsService } from '../../core/services/complaints.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { Complaint, ComplaintTimeline } from '../../core/models/complaint.model';
import { ROUTE_PATHS } from '../../core/constants/route.constants';

interface DashboardActivity {
  complaintId: string;
  complaintTitle: string;
  status: string;
  title: string;
  description: string;
  timestamp: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatCardModule, PageHeaderComponent, DatePipe],
  template: `
    <div class="dashboard animate-fade-in-up">
      <app-page-header
        title="Citizen Portal"
        subtitle="Welcome back, {{ authService.userFullName() }}! Manage and track your neighborhood civic issues."
        icon="home"
      />

      <!-- Welcome and Profile Quick Link -->
      <div class="dashboard__welcome-banner">
        <div class="dashboard__welcome-left">
          <h2>Hello, {{ authService.user()?.firstName }}! 👋</h2>
          <p>
            You are logged in as a registered citizen. You can submit new local complaints, check progress on existing reports, and manage your account options.
          </p>
          <div class="dashboard__welcome-actions">
            <button mat-flat-button color="primary" [routerLink]="['/', paths.report]">
              <mat-icon>add_circle</mat-icon> Report New Issue
            </button>
            <button mat-stroked-button [routerLink]="['/', paths.complaints.root]">
              <mat-icon>assignment</mat-icon> View My Reports
            </button>
          </div>
        </div>
        <div class="dashboard__welcome-right">
          <div class="dashboard__profile-shortcut">
            <div class="dashboard__profile-avatar">
              {{ authService.userInitials() }}
            </div>
            <div class="dashboard__profile-info">
              <h4>{{ authService.userFullName() }}</h4>
              <span class="email">{{ authService.user()?.email }}</span>
              <span class="phone">{{ authService.user()?.phone || 'No phone added' }}</span>
            </div>
            <button mat-button class="dashboard__edit-profile-btn" [routerLink]="['/', paths.profile]">
              <mat-icon>edit</mat-icon> Update Profile
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <h3 class="dashboard__section-title">Complaint Summary</h3>
      <div class="dashboard__stats">
        @for (stat of stats(); track stat.label) {
          <div class="dashboard__stat-card">
            <div class="dashboard__stat-icon" [style.background]="stat.bg">
              <mat-icon [style.color]="stat.color">{{ stat.icon }}</mat-icon>
            </div>
            <div class="dashboard__stat-content">
              <span class="dashboard__stat-value">{{ stat.value }}</span>
              <span class="dashboard__stat-label">{{ stat.label }}</span>
            </div>
          </div>
        }
      </div>

      <div class="dashboard__grid">
        <!-- Recent Activities -->
        <div class="dashboard__grid-card recent-activity">
          <div class="dashboard__grid-card-header">
            <h3>Recent Activity</h3>
            <mat-icon>notifications_active</mat-icon>
          </div>
          <div class="dashboard__grid-card-content">
            @if (recentActivities().length === 0) {
              <div class="dashboard__empty-state">
                <mat-icon>info_outline</mat-icon>
                <p>No recent activity. Reported issues and status updates will appear here.</p>
              </div>
            } @else {
              <div class="dashboard__activity-list">
                @for (activity of recentActivities(); track activity.timestamp + activity.complaintId) {
                  <div class="dashboard__activity-item" [routerLink]="['/', paths.complaints.root, activity.complaintId]">
                    <div class="dashboard__activity-status-dot" [class]="activity.status"></div>
                    <div class="dashboard__activity-details">
                      <div class="dashboard__activity-title">
                        <strong>{{ activity.title }}</strong> 
                        <span class="complaint-ref">on "{{ activity.complaintTitle }}"</span>
                      </div>
                      <p class="dashboard__activity-desc">{{ activity.description }}</p>
                      <span class="dashboard__activity-time">
                        {{ activity.timestamp | date:'medium' }}
                      </span>
                    </div>
                    <mat-icon class="dashboard__activity-chevron">chevron_right</mat-icon>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Quick Actions Shortcuts -->
        <div class="dashboard__grid-card quick-actions">
          <div class="dashboard__grid-card-header">
            <h3>Quick Access Shortcuts</h3>
            <mat-icon>offline_bolt</mat-icon>
          </div>
          <div class="dashboard__grid-card-content">
            <div class="dashboard__actions-grid">
              <a class="dashboard__action-tile" [routerLink]="['/', paths.report]">
                <div class="dashboard__action-tile-icon purple">
                  <mat-icon>campaign</mat-icon>
                </div>
                <div class="dashboard__action-tile-text">
                  <h4>Report Complaint</h4>
                  <p>Submit details with AI categorization</p>
                </div>
              </a>

              <a class="dashboard__action-tile" [routerLink]="['/', paths.complaints.root]">
                <div class="dashboard__action-tile-icon blue">
                  <mat-icon>track_changes</mat-icon>
                </div>
                <div class="dashboard__action-tile-text">
                  <h4>Track Issues</h4>
                  <p>Check active complaint status updates</p>
                </div>
              </a>

              <a class="dashboard__action-tile" [routerLink]="['/', paths.profile]">
                <div class="dashboard__action-tile-icon green">
                  <mat-icon>manage_accounts</mat-icon>
                </div>
                <div class="dashboard__action-tile-text">
                  <h4>Manage Profile</h4>
                  <p>Update phone, address, and personal bio</p>
                </div>
              </a>

              <a class="dashboard__action-tile" [routerLink]="['/', paths.notifications]">
                <div class="dashboard__action-tile-icon orange">
                  <mat-icon>mail</mat-icon>
                </div>
                <div class="dashboard__action-tile-text">
                  <h4>Notifications</h4>
                  <p>Configure alerts & email configurations</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .dashboard {
      &__welcome-banner {
        @include card-base;
        padding: $spacing-6;
        background: linear-gradient(135deg, rgba($primary, 0.05) 0%, rgba($secondary, 0.08) 100%);
        border: 1px solid rgba($primary, 0.15);
        display: flex;
        flex-direction: column;
        gap: $spacing-6;
        margin-bottom: $spacing-8;

        @include md {
          flex-direction: row;
          align-items: stretch;
        }
      }

      &__welcome-left {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;

        h2 {
          font-size: $font-size-2xl;
          color: $primary-dark;
          margin-bottom: $spacing-2;
        }

        p {
          font-size: $font-size-base;
          color: $text-secondary;
          line-height: $line-height-relaxed;
          margin-bottom: $spacing-5;
          max-width: 600px;
        }
      }

      &__welcome-actions {
        display: flex;
        flex-wrap: wrap;
        gap: $spacing-3;

        button {
          @include flex-center;
          gap: $spacing-2;
        }
      }

      &__welcome-right {
        width: 100%;
        max-width: 320px;
        align-self: center;
        flex-shrink: 0;

        @include mobile-only {
          max-width: 100%;
          border-top: 1px solid rgba($primary, 0.1);
          padding-top: $spacing-6;
        }
      }

      &__profile-shortcut {
        @include flex-column-center;
        background: $surface;
        padding: $spacing-5;
        border-radius: $radius-xl;
        border: 1px solid $border;
        text-align: center;
      }

      &__profile-avatar {
        @include flex-center;
        width: 64px;
        height: 64px;
        border-radius: $radius-full;
        background: $gradient-primary;
        color: $text-inverse;
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        margin-bottom: $spacing-3;
        box-shadow: $shadow-md;
      }

      &__profile-info {
        margin-bottom: $spacing-4;

        h4 {
          font-size: $font-size-base;
          font-weight: $font-weight-semibold;
          color: $text-primary;
          margin-bottom: $spacing-1;
        }

        span {
          display: block;
          font-size: $font-size-xs;
          color: $text-secondary;

          &.email {
            font-weight: $font-weight-medium;
          }
        }
      }

      &__edit-profile-btn {
        width: 100%;
        border-radius: $radius-md;
      }

      &__section-title {
        font-size: $font-size-lg;
        font-weight: $font-weight-bold;
        color: $text-primary;
        margin-bottom: $spacing-4;
      }

      &__stats {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: $spacing-4;
        margin-bottom: $spacing-8;
      }

      &__stat-card {
        @include card-base;
        padding: $spacing-4 $spacing-5;
        display: flex;
        align-items: center;
        gap: $spacing-4;
      }

      &__stat-icon {
        @include flex-center;
        width: 48px;
        height: 48px;
        border-radius: $radius-lg;
        flex-shrink: 0;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      &__stat-content {
        display: flex;
        flex-direction: column;
      }

      &__stat-value {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;
        color: $text-primary;
        line-height: 1;
      }

      &__stat-label {
        font-size: $font-size-xs;
        color: $text-secondary;
        margin-top: $spacing-1;
        font-weight: $font-weight-medium;
      }

      &__grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: $spacing-6;
        align-items: start;

        @include lg {
          grid-template-columns: 1.2fr 0.8fr;
        }
      }

      &__grid-card {
        @include card-base;
        padding: $spacing-6;
        min-height: 280px;
      }

      &__grid-card-header {
        @include flex-between;
        margin-bottom: $spacing-5;
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

      &__empty-state {
        @include flex-column-center;
        padding: $spacing-10 $spacing-4;
        color: $text-muted;

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          margin-bottom: $spacing-2;
        }

        p {
          font-size: $font-size-sm;
        }
      }

      &__activity-list {
        display: flex;
        flex-direction: column;
        gap: $spacing-3;
      }

      &__activity-item {
        display: flex;
        align-items: flex-start;
        gap: $spacing-3;
        padding: $spacing-3;
        border-radius: $radius-md;
        background: $background;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all $transition-fast;

        &:hover {
          background: $surface;
          border-color: $border;
          box-shadow: $shadow-sm;

          .dashboard__activity-chevron {
            transform: translateX(2px);
            color: $primary;
          }
        }
      }

      &__activity-status-dot {
        width: 10px;
        height: 10px;
        border-radius: $radius-full;
        margin-top: 5px;
        flex-shrink: 0;

        &.submitted { background-color: $warning; }
        &.ai_reviewed { background-color: $info; }
        &.assigned { background-color: #8B5CF6; }
        &.in_progress { background-color: #06B6D4; }
        &.resolved { background-color: $success; }
        &.closed { background-color: $text-muted; }
      }

      &__activity-details {
        flex: 1;
        min-width: 0;
      }

      &__activity-title {
        font-size: $font-size-sm;
        color: $text-primary;

        .complaint-ref {
          color: $text-secondary;
          font-weight: $font-weight-regular;
        }
      }

      &__activity-desc {
        font-size: $font-size-xs;
        color: $text-secondary;
        margin: $spacing-1 0;
        @include text-truncate;
      }

      &__activity-time {
        font-size: $font-size-xs;
        color: $text-muted;
      }

      &__activity-chevron {
        align-self: center;
        color: $icon-muted;
        transition: all $transition-fast;
      }

      &__actions-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: $spacing-4;

        @include sm {
          grid-template-columns: 1fr 1fr;
        }
        @include lg {
          grid-template-columns: 1fr;
        }
      }

      &__action-tile {
        display: flex;
        align-items: center;
        gap: $spacing-4;
        padding: $spacing-4;
        border-radius: $radius-lg;
        background: $background;
        border: 1px solid transparent;
        text-decoration: none;
        transition: all $transition-fast;

        &:hover {
          background: $surface;
          border-color: $border;
          box-shadow: $shadow-sm;
          text-decoration: none;

          h4 {
            color: $primary;
          }
        }
      }

      &__action-tile-icon {
        @include flex-center;
        width: 44px;
        height: 44px;
        border-radius: $radius-md;
        flex-shrink: 0;

        mat-icon {
          color: $text-inverse;
          font-size: 22px;
          width: 22px;
          height: 22px;
        }

        &.purple { background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%); }
        &.blue { background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%); }
        &.green { background: linear-gradient(135deg, #10B981 0%, #34D399 100%); }
        &.orange { background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%); }
      }

      &__action-tile-text {
        min-width: 0;

        h4 {
          font-size: $font-size-sm;
          font-weight: $font-weight-bold;
          color: $text-primary;
          margin-bottom: 2px;
        }

        p {
          font-size: $font-size-xs;
          color: $text-secondary;
          margin: 0;
          @include text-truncate;
        }
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  readonly paths = ROUTE_PATHS;
  private readonly complaints = signal<Complaint[]>([]);

  constructor(
    readonly authService: AuthService,
    private readonly complaintsService: ComplaintsService
  ) {}

  ngOnInit(): void {
    this.complaintsService.getComplaints().subscribe({
      next: (res) => {
        if (res.success && res.data?.complaints) {
          this.complaints.set(res.data.complaints);
        }
      },
      error: (err) => console.error('Error fetching dashboard stats:', err)
    });
  }

  // Derived statistics using Angular Signals
  readonly countTotal = computed(() => this.complaints().length);
  readonly countPending = computed(() => this.complaints().filter(c => c.status === 'submitted').length);
  readonly countUnderReview = computed(() => 
    this.complaints().filter(c => ['ai_reviewed', 'assigned', 'in_progress'].includes(c.status)).length
  );
  readonly countResolved = computed(() => this.complaints().filter(c => c.status === 'resolved').length);
  readonly countClosed = computed(() => this.complaints().filter(c => c.status === 'closed').length);

  readonly stats = computed(() => [
    { label: 'Total Complaints', value: this.countTotal().toString(), icon: 'assignment', color: '#16A34A', bg: '#DCFCE7' },
    { label: 'Pending Review', value: this.countPending().toString(), icon: 'pending_actions', color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'Under Investigation', value: this.countUnderReview().toString(), icon: 'manage_search', color: '#0EA5E9', bg: '#E0F2FE' },
    { label: 'Resolved Issues', value: this.countResolved().toString(), icon: 'check_circle', color: '#059669', bg: '#D1FAE5' },
    { label: 'Closed Cases', value: this.countClosed().toString(), icon: 'folder_off', color: '#64748B', bg: '#F1F5F9' },
  ]);

  // Aggregate recent activity list from timelines of all complaints (last 5 changes)
  readonly recentActivities = computed((): DashboardActivity[] => {
    const list: DashboardActivity[] = [];
    
    for (const c of this.complaints()) {
      if (!c.timeline) continue;
      for (const t of c.timeline) {
        list.push({
          complaintId: c._id,
          complaintTitle: c.title,
          status: t.status,
          title: t.title,
          description: t.description,
          timestamp: t.timestamp
        });
      }
    }

    // Sort by timestamp descending and take the top 5
    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  });
}
