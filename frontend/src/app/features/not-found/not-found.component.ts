import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found">
      <div class="not-found__content animate-fade-in-up">
        <div class="not-found__illustration">
          <span class="not-found__code">404</span>
        </div>
        <h1 class="not-found__title">Page Not Found</h1>
        <p class="not-found__description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a mat-flat-button color="primary" routerLink="/" class="not-found__btn">
          <mat-icon>home</mat-icon>
          <span>Back to Home</span>
        </a>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      .not-found {
        @include flex-column-center;
        min-height: 100vh;
        padding: $spacing-6;
        background: $background;

        &__content {
          text-align: center;
          max-width: 480px;
        }

        &__illustration {
          margin-bottom: $spacing-6;
        }

        &__code {
          font-size: 120px;
          font-weight: $font-weight-bold;
          background: $gradient-primary;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
        }

        &__title {
          font-size: $font-size-3xl;
          font-weight: $font-weight-bold;
          color: $text-primary;
          margin-bottom: $spacing-3;
        }

        &__description {
          font-size: $font-size-lg;
          color: $text-secondary;
          line-height: $line-height-relaxed;
          margin-bottom: $spacing-8;
        }

        &__btn {
          height: 48px;
          padding: 0 $spacing-6;
        }
      }
    `,
  ],
})
export class NotFoundComponent {}
