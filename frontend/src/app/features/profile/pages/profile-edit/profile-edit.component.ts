import { Component, OnInit, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CitizenService } from '../../../../core/services/citizen.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-profile-edit',
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="profile-page animate-fade-in-up">
      <app-page-header
        title="Account Settings"
        subtitle="Manage your personal profile information, security password options, and notifications."
        icon="settings"
      />

      <div class="profile-layout">
        <!-- Settings Tabs Sidebar -->
        <div class="profile-sidebar">
          @for (tab of tabs; track tab.id) {
            <button
              class="sidebar-tab"
              [class.sidebar-tab--active]="activeTab() === tab.id"
              (click)="setActiveTab(tab.id)"
            >
              <mat-icon>{{ tab.icon }}</mat-icon>
              <span>{{ tab.label }}</span>
            </button>
          }
        </div>

        <!-- Settings Tabs Content -->
        <div class="profile-content">
          <!-- TAB 1: GENERAL INFO -->
          @if (activeTab() === 'general') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Personal Information</h3>
                <p>Modify your contact details and biography.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                  <div class="form-grid">
                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>First Name</mat-label>
                      <input matInput formControlName="firstName" />
                      <mat-icon matPrefix>person</mat-icon>
                      @if (
                        profileForm.get('firstName')?.hasError('required') &&
                        profileForm.get('firstName')?.touched
                      ) {
                        <mat-error>First name is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>Last Name</mat-label>
                      <input matInput formControlName="lastName" />
                      <mat-icon matPrefix>person</mat-icon>
                      @if (
                        profileForm.get('lastName')?.hasError('required') &&
                        profileForm.get('lastName')?.touched
                      ) {
                        <mat-error>Last name is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>Phone Number</mat-label>
                      <input matInput formControlName="phone" placeholder="+1234567890" />
                      <mat-icon matPrefix>phone</mat-icon>
                      @if (
                        profileForm.get('phone')?.hasError('pattern') &&
                        profileForm.get('phone')?.touched
                      ) {
                        <mat-error>Enter a valid phone number (10-15 digits)</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>Home Address</mat-label>
                      <input
                        matInput
                        formControlName="address"
                        placeholder="123 Main St, Springfield"
                      />
                      <mat-icon matPrefix>home</mat-icon>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-12">
                      <mat-label>Personal Bio / Info</mat-label>
                      <textarea
                        matInput
                        formControlName="bio"
                        rows="3"
                        placeholder="Briefly describe your connection to the community..."
                      ></textarea>
                      <mat-icon matPrefix>info</mat-icon>
                    </mat-form-field>
                  </div>

                  <div class="form-actions">
                    <button
                      mat-flat-button
                      color="primary"
                      type="submit"
                      [disabled]="profileForm.invalid || profileSaving()"
                    >
                      @if (profileSaving()) {
                        <mat-progress-spinner
                          mode="indeterminate"
                          diameter="20"
                          style="display:inline-block; margin-right:6px"
                        ></mat-progress-spinner>
                        Saving Changes...
                      } @else {
                        Save Profile
                      }
                    </button>
                  </div>
                </form>
              </div>
            </mat-card>
          }

          <!-- TAB 2: SECURITY -->
          @if (activeTab() === 'security') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Password Security</h3>
                <p>Change your credentials below. We recommend a strong, unique password.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="passwordForm" (ngSubmit)="savePassword()">
                  <div class="form-grid">
                    <mat-form-field appearance="outline" class="col-12">
                      <mat-label>Current Password</mat-label>
                      <input
                        matInput
                        [type]="hideCurrent() ? 'password' : 'text'"
                        formControlName="currentPassword"
                      />
                      <mat-icon matPrefix>lock</mat-icon>
                      <button
                        type="button"
                        mat-icon-button
                        matSuffix
                        (click)="hideCurrent.set(!hideCurrent())"
                        aria-label="Toggle password visibility"
                      >
                        <mat-icon>{{ hideCurrent() ? 'visibility_off' : 'visibility' }}</mat-icon>
                      </button>
                      @if (
                        passwordForm.get('currentPassword')?.hasError('required') &&
                        passwordForm.get('currentPassword')?.touched
                      ) {
                        <mat-error>Current password is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>New Password</mat-label>
                      <input
                        matInput
                        [type]="hideNew() ? 'password' : 'text'"
                        formControlName="newPassword"
                      />
                      <mat-icon matPrefix>lock_open</mat-icon>
                      <button
                        type="button"
                        mat-icon-button
                        matSuffix
                        (click)="hideNew.set(!hideNew())"
                        aria-label="Toggle password visibility"
                      >
                        <mat-icon>{{ hideNew() ? 'visibility_off' : 'visibility' }}</mat-icon>
                      </button>
                      @if (
                        passwordForm.get('newPassword')?.hasError('required') &&
                        passwordForm.get('newPassword')?.touched
                      ) {
                        <mat-error>New password is required</mat-error>
                      }
                      @if (
                        passwordForm.get('newPassword')?.hasError('minlength') &&
                        passwordForm.get('newPassword')?.touched
                      ) {
                        <mat-error>Password must be at least 8 characters</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="col-6">
                      <mat-label>Confirm New Password</mat-label>
                      <input
                        matInput
                        [type]="hideConfirm() ? 'password' : 'text'"
                        formControlName="confirmPassword"
                      />
                      <mat-icon matPrefix>lock</mat-icon>
                      <button
                        type="button"
                        mat-icon-button
                        matSuffix
                        (click)="hideConfirm.set(!hideConfirm())"
                        aria-label="Toggle password visibility"
                      >
                        <mat-icon>{{ hideConfirm() ? 'visibility_off' : 'visibility' }}</mat-icon>
                      </button>
                      @if (
                        passwordForm.hasError('mismatch') &&
                        passwordForm.get('confirmPassword')?.touched
                      ) {
                        <mat-error>Passwords do not match</mat-error>
                      }
                    </mat-form-field>
                  </div>

                  <div class="form-actions">
                    <button
                      mat-flat-button
                      color="primary"
                      type="submit"
                      [disabled]="passwordForm.invalid || passwordSaving()"
                    >
                      @if (passwordSaving()) {
                        <mat-progress-spinner
                          mode="indeterminate"
                          diameter="20"
                          style="display:inline-block; margin-right:6px"
                        ></mat-progress-spinner>
                        Updating Password...
                      } @else {
                        Change Password
                      }
                    </button>
                  </div>
                </form>
              </div>
            </mat-card>
          }

          <!-- TAB 3: ACTIVITY -->
          @if (activeTab() === 'activity') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Recent Activity</h3>
                <p>View your recent logins and interactions.</p>
              </div>
              <div class="settings-card__body">
                <div class="activity-list">
                  <div class="activity-item">
                    <mat-icon color="primary">login</mat-icon>
                    <div class="activity-details">
                      <strong>Successful Login</strong>
                      <span>Today, just now (IP: 192.168.1.1)</span>
                    </div>
                  </div>
                  <div class="activity-item">
                    <mat-icon color="primary">chat</mat-icon>
                    <div class="activity-details">
                      <strong>AI Conversation Started</strong>
                      <span>Yesterday, 2:45 PM</span>
                    </div>
                  </div>
                  <div class="activity-item">
                    <mat-icon color="primary">report</mat-icon>
                    <div class="activity-details">
                      <strong>Incident Report Submitted</strong>
                      <span>3 days ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </mat-card>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .profile-page {
        display: flex;
        flex-direction: column;
      }

      .profile-layout {
        display: flex;
        flex-direction: column;
        gap: $spacing-6;
        margin-top: $spacing-4;

        @include md {
          flex-direction: row;
          align-items: flex-start;
        }
      }

      // ─── Left Sidebar Tabs ───
      .profile-sidebar {
        display: flex;
        flex-direction: row;
        gap: $spacing-2;
        background: $surface;
        padding: $spacing-2;
        border-radius: $radius-lg;
        border: 1px solid $border;
        width: 100%;
        overflow-x: auto;
        flex-shrink: 0;

        @include md {
          flex-direction: column;
          width: 240px;
          overflow-x: visible;
        }
      }

      .sidebar-tab {
        @include flex-start;
        gap: $spacing-3;
        padding: $spacing-3 $spacing-4;
        background: transparent;
        border: none;
        border-radius: $radius-md;
        color: $text-secondary;
        font-size: $font-size-sm;
        font-weight: $font-weight-medium;
        cursor: pointer;
        width: 100%;
        white-space: nowrap;
        transition: all $transition-fast;

        &:hover {
          background: $background;
          color: $primary;
        }

        &--active {
          background: $primary-light;
          color: $primary-dark;
          font-weight: $font-weight-semibold;

          mat-icon {
            color: $primary;
          }

          &:hover {
            background: $primary-light;
            color: $primary-dark;
          }
        }

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: $icon-secondary;
        }
      }

      // ─── Right Content Card ───
      .profile-content {
        flex: 1;
        min-width: 0;
      }

      .settings-card {
        @include card-base;
        border: 1px solid $border;
        padding: $spacing-6 $spacing-8;

        @include mobile-only {
          padding: $spacing-5 $spacing-4;
        }

        &__header {
          margin-bottom: $spacing-6;
          border-bottom: 1px solid $border-light;
          padding-bottom: $spacing-4;

          h3 {
            font-size: $font-size-lg;
            font-weight: $font-weight-bold;
            color: $text-primary;
            margin-bottom: 2px;
          }

          p {
            font-size: $font-size-xs;
            color: $text-secondary;
            margin: 0;
          }
        }
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 0 $spacing-4;

        .col-12 {
          grid-column: span 12;
        }
        .col-6 {
          grid-column: span 12;
        }

        @include sm {
          .col-6 {
            grid-column: span 6;
          }
        }
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: $spacing-6;
        border-top: 1px solid $border-light;
        padding-top: $spacing-4;

        button {
          @include flex-center;
          gap: 6px;
        }
      }

      // ─── Notification preferences item formatting ───
      .prefs-list {
        display: flex;
        flex-direction: column;
        gap: $spacing-5;
      }

      .pref-item {
        padding: $spacing-3;
        border-radius: $radius-md;
        background: $background;
        border: 1px solid $border-light;
        transition: all $transition-fast;

        &:hover {
          border-color: $border;
          background: $surface;
        }

        ::ng-deep .mdc-checkbox {
          align-self: flex-start;
          margin-top: -8px;
        }

        &__label {
          strong {
            display: block;
            font-size: $font-size-sm;
            color: $text-primary;
            margin-bottom: 2px;
          }
          p {
            font-size: $font-size-xs;
            color: $text-secondary;
            margin: 0;
            line-height: $line-height-normal;
          }
        }
      }

      // ─── Activity List ───
      .activity-list {
        display: flex;
        flex-direction: column;
        gap: $spacing-4;
      }

      .activity-item {
        display: flex;
        align-items: center;
        gap: $spacing-4;
        padding: $spacing-3;
        border-radius: $radius-md;
        background: $background;
        border: 1px solid $border-light;

        mat-icon {
          background: $primary-light;
          padding: 8px;
          border-radius: 50%;
          color: $primary;
        }

        .activity-details {
          display: flex;
          flex-direction: column;

          strong {
            font-size: $font-size-sm;
            color: $text-primary;
          }

          span {
            font-size: $font-size-xs;
            color: $text-secondary;
          }
        }
      }
    `,
  ],
})
export class ProfileEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly citizenService = inject(CitizenService);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);

  readonly activeTab = signal('general');
  readonly tabs = [
    { id: 'general', label: 'Profile details', icon: 'person' },
    { id: 'security', label: 'Security & login', icon: 'shield' },
    { id: 'activity', label: 'Recent Activity', icon: 'history' },
  ];

  // Passwords hiding
  readonly hideCurrent = signal(true);
  readonly hideNew = signal(true);
  readonly hideConfirm = signal(true);

  // Loaders
  readonly profileSaving = signal(false);
  readonly passwordSaving = signal(false);

  // Forms
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  ngOnInit(): void {
    const user = this.authService.user();

    // Initialize Profile details form
    this.profileForm = this.fb.group({
      firstName: [user?.firstName || '', Validators.required],
      lastName: [user?.lastName || '', Validators.required],
      phone: [user?.phone || '', Validators.pattern(/^\+?[\d\s-]{10,15}$/)],
      address: [user?.address || ''],
      bio: [user?.bio || ''],
    });

    // Initialize password changes form
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      {
        validators: this.passwordMatchValidator,
      },
    );
  }

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
    const newPass = g.get('newPassword')?.value;
    const confirmPass = g.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { mismatch: true };
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);

    this.citizenService.updateProfile(this.profileForm.value).subscribe({
      next: (res) => {
        this.profileSaving.set(false);
        if (res.success) {
          this.notification.success('Your profile details were updated.');
          // Sync changes globally
          this.authService.getMe().subscribe();
        }
      },
      error: (err) => {
        this.profileSaving.set(false);
        this.notification.error(err.error?.message || 'Failed to update profile details.');
      },
    });
  }

  savePassword(): void {
    if (this.passwordForm.invalid) return;
    this.passwordSaving.set(true);

    const payload = {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword,
    };

    this.citizenService.changePassword(payload).subscribe({
      next: (res) => {
        this.passwordSaving.set(false);
        this.notification.success('Your password was updated successfully.');
        this.passwordForm.reset();
      },
      error: (err) => {
        this.passwordSaving.set(false);
        this.notification.error(
          err.error?.message || 'Incorrect current password or change failed.',
        );
      },
    });
  }
}
