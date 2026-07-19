import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading-overlay" [class.fullscreen]="fullscreen()" [class.inline]="!fullscreen()">
      <div class="loading-content">
        <mat-spinner [diameter]="diameter()" color="primary"></mat-spinner>
        @if (message()) {
          <p class="loading-message">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;

    .loading-overlay {
      display: flex;
      align-items: center;
      justify-content: center;

      &.fullscreen {
        position: fixed;
        inset: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(4px);
        z-index: $z-modal;
      }

      &.inline {
        padding: $spacing-8;
      }
    }

    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: $spacing-4;
    }

    .loading-message {
      font-size: $font-size-sm;
      color: $text-secondary;
      font-weight: $font-weight-medium;
    }
  `],
})
export class LoadingSpinnerComponent {
  readonly diameter = input(48);
  readonly message = input<string>('');
  readonly fullscreen = input(false);
}
