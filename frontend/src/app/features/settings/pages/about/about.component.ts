import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, PageHeaderComponent],
  template: `
    <div class="about-page animate-fade-in-up">
      <app-page-header
        title="About CivicPulse AI"
        subtitle="Bridging the gap between citizens and municipal governance."
        icon="info"
      />

      <div class="about-content">
        <mat-card class="about-card">
          <div class="logo-container">
            <img src="logo.jpg" alt="CivicPulse AI Logo" class="logo" style="border-radius: 12px; object-fit: cover;">
            <h2>CivicPulse AI</h2>
            <span class="version">Version {{ version }}</span>
          </div>

          <div class="info-section">
            <p>
              CivicPulse AI is an intelligent civic engagement platform designed to streamline 
              municipal issue reporting and resolution. By leveraging artificial intelligence, 
              we automatically categorize, prioritize, and route citizen complaints to the 
              appropriate municipal officers.
            </p>
          </div>

          <div class="features-grid">
            <div class="feature">
              <mat-icon color="primary">translate</mat-icon>
              <h4>Multilingual AI</h4>
              <p>Communicate in Tamil or English. Our AI understands and translates seamlessly.</p>
            </div>
            <div class="feature">
              <mat-icon color="primary">bolt</mat-icon>
              <h4>Smart Routing</h4>
              <p>Issues are instantly assigned to the right department based on AI categorization.</p>
            </div>
            <div class="feature">
              <mat-icon color="primary">visibility</mat-icon>
              <h4>Complete Transparency</h4>
              <p>Track your complaints in real-time with automated status updates.</p>
            </div>
          </div>

          <div class="footer-links">
            <a mat-button href="#">Terms of Service</a>
            <a mat-button href="#">Privacy Policy</a>
            <a mat-button href="#">Open Source Licenses</a>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .about-page {
      display: flex;
      flex-direction: column;
    }

    .about-content {
      max-width: 800px;
      margin: $spacing-6 auto 0;
      width: 100%;
    }

    .about-card {
      @include card-base;
      padding: $spacing-8;
      text-align: center;
    }

    .logo-container {
      margin-bottom: $spacing-8;
      
      .logo {
        width: 120px;
        height: 120px;
        object-fit: contain;
        margin-bottom: $spacing-4;
      }

      h2 {
        margin: 0 0 $spacing-1 0;
        color: $text-primary;
        font-size: $font-size-2xl;
      }

      .version {
        color: $text-secondary;
        font-size: $font-size-sm;
      }
    }

    .info-section {
      max-width: 600px;
      margin: 0 auto $spacing-10;

      p {
        color: $text-secondary;
        line-height: 1.6;
        font-size: $font-size-lg;
      }
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: $spacing-6;
      margin-bottom: $spacing-10;
      text-align: left;

      @include md {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .feature {
      padding: $spacing-6;
      background: $surface;
      border-radius: $radius-lg;
      border: 1px solid $border-light;

      mat-icon {
        margin-bottom: $spacing-3;
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      h4 {
        margin: 0 0 $spacing-2 0;
        color: $text-primary;
        font-size: $font-size-base;
      }

      p {
        margin: 0;
        color: $text-secondary;
        font-size: $font-size-sm;
        line-height: 1.5;
      }
    }

    .footer-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: $spacing-2;
      padding-top: $spacing-6;
      border-top: 1px solid $border-light;

      a {
        color: $text-secondary;
      }
    }
  `]
})
export class AboutComponent {
  version = '1.0.0';
}
