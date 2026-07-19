import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <div class="auth-layout">
      <!-- Left: Branding Panel -->
      <div class="auth-layout__brand">
        <div class="auth-layout__brand-content animate-fade-in">
          <div class="auth-layout__logo">
            <div class="auth-layout__logo-icon">
              <img src="logo.jpg" alt="CivicPulse Logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
            </div>
          </div>

          <h1 class="auth-layout__title">CivicPulse</h1>
          <p class="auth-layout__subtitle">AI-Powered Community Issue<br>Reporting & Resolution</p>

          <div class="auth-layout__features">
            <div class="auth-layout__feature">
              <div class="auth-layout__feature-icon">✦</div>
              <span>AI-Powered Analysis</span>
            </div>
            <div class="auth-layout__feature">
              <div class="auth-layout__feature-icon">◉</div>
              <span>Real-time Tracking</span>
            </div>
            <div class="auth-layout__feature">
              <div class="auth-layout__feature-icon">⬡</div>
              <span>Smart Resolution</span>
            </div>
          </div>
        </div>

        <div class="auth-layout__brand-footer">
          <p>&copy; 2024 CivicPulse. Building better communities.</p>
        </div>
      </div>

      <!-- Right: Auth Form -->
      <div class="auth-layout__content">
        <div class="auth-layout__form-wrapper animate-fade-in-up">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .auth-layout {
      display: flex;
      min-height: 100vh;

      // ─── Brand Panel ───
      &__brand {
        display: none;
        width: 45%;
        max-width: 600px;
        background: $gradient-dark;
        padding: $spacing-10;
        position: relative;
        overflow: hidden;
        flex-direction: column;
        justify-content: center;

        @include lg {
          display: flex;
        }

        // Decorative circles
        &::before {
          content: '';
          position: absolute;
          top: -100px;
          right: -100px;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
        }

        &::after {
          content: '';
          position: absolute;
          bottom: -150px;
          left: -150px;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
        }
      }

      &__brand-content {
        position: relative;
        z-index: 1;
      }

      &__logo {
        margin-bottom: $spacing-8;
      }

      &__logo-icon {
        width: 64px;
        height: 64px;
        border-radius: $radius-xl;
        background: transparent;
        @include flex-center;
        backdrop-filter: blur(8px);
      }

      &__title {
        font-size: 2.5rem;
        font-weight: $font-weight-bold;
        color: $text-inverse;
        margin-bottom: $spacing-3;
        letter-spacing: -0.02em;
      }

      &__subtitle {
        font-size: $font-size-lg;
        color: rgba(255, 255, 255, 0.8);
        line-height: $line-height-relaxed;
        margin-bottom: $spacing-10;
      }

      &__features {
        display: flex;
        flex-direction: column;
        gap: $spacing-4;
      }

      &__feature {
        display: flex;
        align-items: center;
        gap: $spacing-3;
        color: rgba(255, 255, 255, 0.9);
        font-size: $font-size-base;
        font-weight: $font-weight-medium;
      }

      &__feature-icon {
        @include flex-center;
        width: 32px;
        height: 32px;
        border-radius: $radius-md;
        background: rgba(255, 255, 255, 0.15);
        font-size: $font-size-sm;
        flex-shrink: 0;
      }

      &__brand-footer {
        position: absolute;
        bottom: $spacing-8;
        left: $spacing-10;
        z-index: 1;

        p {
          font-size: $font-size-sm;
          color: rgba(255, 255, 255, 0.5);
        }
      }

      // ─── Content Panel ───
      &__content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: $spacing-6;
        background: $background;
        overflow-y: auto;

        @include mobile-only {
          padding: $spacing-4;
          align-items: flex-start;
          padding-top: $spacing-8;
        }
      }

      &__form-wrapper {
        width: 100%;
        max-width: $auth-card-max-width;
      }
    }
  `],
})
export class AuthLayoutComponent {}
