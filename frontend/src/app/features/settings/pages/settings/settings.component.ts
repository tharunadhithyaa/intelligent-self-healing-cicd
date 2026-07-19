import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { AIChatService } from '../../../../core/services/ai-chat.service';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    PageHeaderComponent
  ],
  template: `
    <div class="settings-page animate-fade-in-up">
      <app-page-header
        title="Settings"
        subtitle="Configure your CivicPulse application preferences and defaults."
        icon="settings_applications"
      />

      <div class="settings-layout">
        <div class="settings-sidebar">
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

        <div class="settings-content">
          <!-- APPEARANCE -->
          @if (activeTab() === 'appearance') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Appearance & Theme</h3>
                <p>Customize the look and feel of the platform.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="appearanceForm" class="settings-form">
                  <div class="form-section">
                    <h4>Theme Selection</h4>
                    <mat-form-field appearance="outline">
                      <mat-label>Color Theme</mat-label>
                      <mat-select formControlName="theme">
                        <mat-option value="light">Light Mode</mat-option>
                        <mat-option value="dark">Dark Mode</mat-option>
                        <mat-option value="system">System Default</mat-option>
                        <mat-option value="green">CivicPulse Green</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="form-section">
                    <h4>Layout Settings</h4>
                    <mat-slide-toggle formControlName="compactMode" color="primary">Enable Compact Mode</mat-slide-toggle>
                    <p class="help-text">Reduces spacing and shows more information on screen.</p>
                  </div>
                </form>
              </div>
              <div class="settings-card__actions">
                <button mat-flat-button color="primary" (click)="saveSettings()">Save Preferences</button>
              </div>
            </mat-card>
          }

          <!-- NOTIFICATIONS -->
          @if (activeTab() === 'notifications') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Notifications</h3>
                <p>Manage how and when you want to be alerted.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="notificationsForm" class="settings-form">
                  <div class="prefs-list">
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="email" color="primary">
                        <strong>Email Notifications</strong>
                        <p>Receive reports and summaries via email.</p>
                      </mat-slide-toggle>
                    </div>
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="sms" color="primary">
                        <strong>SMS Alerts</strong>
                        <p>Get critical safety alerts as text messages.</p>
                      </mat-slide-toggle>
                    </div>
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="complaints" color="primary">
                        <strong>Complaint Updates</strong>
                        <p>Notify when my incidents change status.</p>
                      </mat-slide-toggle>
                    </div>
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="system" color="primary">
                        <strong>System Announcements</strong>
                        <p>Maintenance and feature updates.</p>
                      </mat-slide-toggle>
                    </div>
                  </div>
                </form>
              </div>
              <div class="settings-card__actions">
                <button mat-flat-button color="primary" (click)="saveSettings()">Save Preferences</button>
              </div>
            </mat-card>
          }

          <!-- PRIVACY -->
          @if (activeTab() === 'privacy') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Privacy</h3>
                <p>Control your data and visibility settings.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="privacyForm" class="settings-form">
                  <div class="prefs-list">
                    <div class="pref-item">
                      <mat-checkbox formControlName="showProfile" color="primary">
                        <div class="pref-item__label">
                          <strong>Show Profile Picture</strong>
                          <p>Allow others to see your avatar across the platform.</p>
                        </div>
                      </mat-checkbox>
                    </div>
                    <div class="pref-item">
                      <mat-checkbox formControlName="showContact" color="primary">
                        <div class="pref-item__label">
                          <strong>Show Contact Info</strong>
                          <p>Make email and phone visible to resolving officers.</p>
                        </div>
                      </mat-checkbox>
                    </div>
                  </div>
                  
                  <div class="data-actions">
                    <h4>Data Management</h4>
                    <button mat-stroked-button color="primary" type="button" (click)="downloadData()">Download Account Data</button>
                    <button mat-stroked-button color="warn" type="button" style="margin-left: 12px;" (click)="deleteConversations()">Delete Conversation History</button>
                  </div>
                </form>
              </div>
              <div class="settings-card__actions">
                <button mat-flat-button color="primary" (click)="saveSettings()">Save Preferences</button>
              </div>
            </mat-card>
          }

          <!-- LANGUAGE -->
          @if (activeTab() === 'language') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Language & Localization</h3>
                <p>Choose your preferred language for the interface.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="languageForm" class="settings-form">
                  <div class="form-section">
                    <mat-form-field appearance="outline">
                      <mat-label>Display Language</mat-label>
                      <mat-select formControlName="language">
                        <mat-option value="en">English (US)</mat-option>
                        <mat-option value="ta">Tamil (தமிழ்)</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                </form>
              </div>
              <div class="settings-card__actions">
                <button mat-flat-button color="primary" (click)="saveSettings()">Save Preferences</button>
              </div>
            </mat-card>
          }

          <!-- ACCESSIBILITY -->
          @if (activeTab() === 'accessibility') {
            <mat-card class="settings-card animate-fade-in-up">
              <div class="settings-card__header">
                <h3>Accessibility</h3>
                <p>Improve visibility and ease of use.</p>
              </div>
              <div class="settings-card__body">
                <form [formGroup]="accessibilityForm" class="settings-form">
                  <div class="prefs-list">
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="highContrast" color="primary">
                        <strong>High Contrast Mode</strong>
                        <p>Increase contrast for text and interface elements.</p>
                      </mat-slide-toggle>
                    </div>
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="reducedMotion" color="primary">
                        <strong>Reduced Motion</strong>
                        <p>Disable non-essential animations across the app.</p>
                      </mat-slide-toggle>
                    </div>
                    <div class="pref-item">
                      <mat-slide-toggle formControlName="largerText" color="primary">
                        <strong>Larger Text</strong>
                        <p>Increase the base font size for better readability.</p>
                      </mat-slide-toggle>
                    </div>
                  </div>
                </form>
              </div>
              <div class="settings-card__actions">
                <button mat-flat-button color="primary" (click)="saveSettings()">Save Preferences</button>
              </div>
            </mat-card>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .settings-page {
      display: flex;
      flex-direction: column;
    }

    .settings-layout {
      display: flex;
      flex-direction: column;
      gap: $spacing-6;
      margin-top: $spacing-4;

      @include md {
        flex-direction: row;
        align-items: flex-start;
      }
    }

    .settings-sidebar {
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
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: $icon-secondary;
      }
    }

    .settings-content {
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
      
      &__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: $spacing-6;
        padding-top: $spacing-4;
        border-top: 1px solid $border-light;
      }
    }

    .settings-form {
      display: flex;
      flex-direction: column;
      gap: $spacing-5;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: $spacing-3;
      
      h4 {
        margin: 0;
        font-size: $font-size-base;
        color: $text-primary;
        font-weight: 500;
      }
      
      .help-text {
        font-size: $font-size-xs;
        color: $text-muted;
        margin: -4px 0 0 0;
      }
    }

    .prefs-list {
      display: flex;
      flex-direction: column;
      gap: $spacing-4;
    }

    .pref-item {
      padding: $spacing-3 $spacing-4;
      border-radius: $radius-md;
      background: $background;
      border: 1px solid $border-light;
      transition: all $transition-fast;

      &:hover {
        border-color: $border;
        background: $surface;
      }
      
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

      ::ng-deep .mdc-checkbox, ::ng-deep .mdc-switch {
        align-self: flex-start;
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
    
    .data-actions {
      margin-top: $spacing-6;
      padding-top: $spacing-4;
      border-top: 1px dashed $border-light;
      
      h4 {
        margin: 0 0 $spacing-3 0;
        font-size: $font-size-base;
        color: $text-primary;
      }
    }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly notification = inject(NotificationService);
  private readonly settingsService = inject(SettingsService);
  private readonly translationService = inject(TranslationService);
  private readonly aiChatService = inject(AIChatService);
  private readonly dialog = inject(MatDialog);

  readonly activeTab = signal('appearance');
  readonly tabs = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'privacy', label: 'Privacy', icon: 'security' },
    { id: 'language', label: 'Language', icon: 'language' },
    { id: 'accessibility', label: 'Accessibility', icon: 'accessibility' }
  ];

  appearanceForm!: FormGroup;
  notificationsForm!: FormGroup;
  privacyForm!: FormGroup;
  languageForm!: FormGroup;
  accessibilityForm!: FormGroup;

  ngOnInit(): void {
    const current = this.settingsService.settings();

    this.appearanceForm = this.fb.group({
      theme: [current.appearance?.theme || 'system'],
      compactMode: [current.appearance?.compactMode || false]
    });

    this.notificationsForm = this.fb.group({
      email: [current.notifications?.email ?? true],
      sms: [current.notifications?.sms ?? false],
      complaints: [current.notifications?.complaints ?? true],
      system: [current.notifications?.system ?? true]
    });

    this.privacyForm = this.fb.group({
      showProfile: [current.privacy?.showProfile ?? true],
      showContact: [current.privacy?.showContact ?? false]
    });

    this.languageForm = this.fb.group({
      language: [current.language?.language || 'en']
    });

    this.accessibilityForm = this.fb.group({
      highContrast: [current.accessibility?.highContrast || false],
      reducedMotion: [current.accessibility?.reducedMotion || false],
      largerText: [current.accessibility?.largerText || false]
    });
  }

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  saveSettings(): void {
    this.settingsService.updateSettings({
      appearance: this.appearanceForm.value,
      notifications: this.notificationsForm.value,
      privacy: this.privacyForm.value,
      language: this.languageForm.value,
      accessibility: this.accessibilityForm.value
    }).subscribe({
      next: () => {
        this.notification.success('Settings updated successfully.');
        this.translationService.setLanguage(this.languageForm.value.language);
      },
      error: () => this.notification.error('Failed to update settings')
    });
  }

  deleteConversations(): void {
    if (confirm('Are you sure you want to permanently delete all AI conversation history? This action cannot be undone.')) {
      this.aiChatService.deleteAllConversations().subscribe({
        next: () => this.notification.success('AI conversation history deleted.'),
        error: () => this.notification.error('Failed to delete conversations.')
      });
    }
  }

  downloadData(): void {
    this.settingsService.downloadAccountData().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'account_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notification.success('Data download started.');
      },
      error: () => this.notification.error('Failed to download data.')
    });
  }
}
