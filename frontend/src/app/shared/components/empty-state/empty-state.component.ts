import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="empty-state animate-fade-in-up">
      <div class="empty-state__icon-wrapper">
        <mat-icon class="empty-state__icon">{{ icon() }}</mat-icon>
      </div>
      <h3 class="empty-state__title">{{ title() }}</h3>
      @if (description()) {
        <p class="empty-state__description">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button mat-flat-button color="primary" class="empty-state__action" (click)="onAction()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .empty-state {
      @include flex-column-center;
      gap: $spacing-4;
      padding: $spacing-12 $spacing-6;
      text-align: center;

      &__icon-wrapper {
        @include flex-center;
        width: 80px;
        height: 80px;
        border-radius: $radius-full;
        background: $primary-light;
      }

      &__icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: $primary;
      }

      &__title {
        font-size: $font-size-xl;
        font-weight: $font-weight-semibold;
        color: $text-primary;
      }

      &__description {
        font-size: $font-size-base;
        color: $text-secondary;
        max-width: 400px;
        line-height: $line-height-relaxed;
      }

      &__action {
        margin-top: $spacing-2;
      }
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('No data found');
  readonly description = input<string>('');
  readonly actionLabel = input<string>('');

  onAction(): void {}
}
