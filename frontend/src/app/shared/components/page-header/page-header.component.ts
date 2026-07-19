import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-header',
  imports: [MatIconModule],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        @if (icon()) {
          <div class="page-header__icon-wrapper">
            <mat-icon>{{ icon() }}</mat-icon>
          </div>
        }
        <div class="page-header__text">
          <h1 class="page-header__title">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="page-header__subtitle">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="page-header__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .page-header {
      @include flex-between;
      flex-wrap: wrap;
      gap: $spacing-4;
      margin-bottom: $spacing-6;

      &__content {
        @include flex-start;
        gap: $spacing-4;
      }

      &__icon-wrapper {
        @include flex-center;
        width: 48px;
        height: 48px;
        border-radius: $radius-lg;
        background: $primary-light;

        mat-icon {
          color: $primary;
          font-size: 24px;
        }
      }

      &__title {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;
        color: $text-primary;

        @include mobile-only {
          font-size: $font-size-xl;
        }
      }

      &__subtitle {
        font-size: $font-size-sm;
        color: $text-secondary;
        margin-top: $spacing-1;
      }

      &__actions {
        @include flex-start;
        gap: $spacing-3;
      }
    }
  `],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input<string>('');
}
