import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatExpansionModule, PageHeaderComponent],
  template: `
    <div class="help-page animate-fade-in-up">
      <app-page-header
        title="Help & Support"
        subtitle="Find answers to common questions and learn how to use CivicPulse AI."
        icon="help_outline"
      />

      <div class="help-content">
        <mat-accordion multi>
          <mat-expansion-panel expanded>
            <mat-expansion-panel-header>
              <mat-panel-title>How do I submit a new complaint?</mat-panel-title>
            </mat-expansion-panel-header>
            <p>
              To submit a new complaint, navigate to the "Dashboard" and click the "New Complaint" button. 
              You can also use the AI Assistant in the bottom right corner to guide you through the process 
              using natural language.
            </p>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>How long does it take for an issue to be resolved?</mat-panel-title>
            </mat-expansion-panel-header>
            <p>
              Resolution times vary depending on the category and severity of the issue. Emergency reports are 
              typically addressed within 24 hours, while general infrastructure requests may take 3-5 business days 
              for initial assessment by a Field Worker.
            </p>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>How does the AI Assistant work?</mat-panel-title>
            </mat-expansion-panel-header>
            <p>
              The AI Assistant analyzes your descriptions, translates languages (e.g., Tamil to English), 
              automatically categorizes the issue (like "Water Leak" or "Pothole"), and assesses severity. 
              It can also answer questions about your local municipality guidelines.
            </p>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>Is my personal information public?</mat-panel-title>
            </mat-expansion-panel-header>
            <p>
              No, your contact information is kept confidential and is only visible to the municipal officers 
              assigned to your case. You can manage your privacy settings in the Settings page.
            </p>
          </mat-expansion-panel>
        </mat-accordion>

        <div class="contact-support">
          <h3>Still need help?</h3>
          <p>If you couldn't find the answer to your question, our support team is here to assist you.</p>
          <a href="mailto:support@civicpulse.ai" class="support-link">
            <mat-icon>mail</mat-icon>
            Contact Support Team
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .help-page {
      display: flex;
      flex-direction: column;
    }

    .help-content {
      max-width: 800px;
      margin: $spacing-6 auto 0;
      width: 100%;
    }

    mat-expansion-panel {
      margin-bottom: $spacing-4;
      border-radius: $radius-lg !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
      border: 1px solid $border-light;
      background: $surface;

      &::before {
        display: none;
      }

      p {
        color: $text-secondary;
        line-height: 1.6;
        margin-bottom: $spacing-2;
      }
    }

    mat-panel-title {
      font-weight: $font-weight-medium;
      color: $text-primary;
    }

    .contact-support {
      margin-top: $spacing-12;
      padding: $spacing-8;
      background: $primary-light;
      border-radius: $radius-lg;
      text-align: center;

      h3 {
        margin: 0 0 $spacing-2 0;
        color: $primary-dark;
      }

      p {
        color: $text-secondary;
        margin: 0 0 $spacing-6 0;
      }

      .support-link {
        display: inline-flex;
        align-items: center;
        gap: $spacing-2;
        padding: $spacing-3 $spacing-6;
        background: $primary;
        color: var(--text-inverse);
        text-decoration: none;
        border-radius: $radius-full;
        font-weight: $font-weight-medium;
        transition: all $transition-fast;

        &:hover {
          background: $primary-dark;
          transform: translateY(-1px);
        }

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }
  `]
})
export class HelpComponent {}
