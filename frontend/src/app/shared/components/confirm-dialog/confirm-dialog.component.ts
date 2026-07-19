import { Component, inject, signal } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-dialog__header">
        <div class="confirm-dialog__icon" [class]="'type-' + data.type">
          <mat-icon>{{ getIcon() }}</mat-icon>
        </div>
        <h2 class="confirm-dialog__title">{{ data.title }}</h2>
      </div>

      <p class="confirm-dialog__message">{{ data.message }}</p>

      <div class="confirm-dialog__actions">
        <button mat-stroked-button (click)="onCancel()">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          mat-flat-button
          [class]="'btn-' + data.type"
          (click)="onConfirm()"
          [disabled]="loading()"
        >
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .confirm-dialog {
      padding: $spacing-6;
      max-width: 420px;

      &__header {
        @include flex-start;
        gap: $spacing-4;
        margin-bottom: $spacing-4;
      }

      &__icon {
        @include flex-center;
        width: 48px;
        height: 48px;
        border-radius: $radius-full;
        flex-shrink: 0;

        &.type-warning {
          background: $warning-light;
          mat-icon { color: $warning; }
        }

        &.type-danger {
          background: $danger-light;
          mat-icon { color: $danger; }
        }

        &.type-info {
          background: $primary-light;
          mat-icon { color: $primary; }
        }
      }

      &__title {
        font-size: $font-size-lg;
        font-weight: $font-weight-semibold;
        color: $text-primary;
      }

      &__message {
        font-size: $font-size-base;
        color: $text-secondary;
        line-height: $line-height-relaxed;
        margin-bottom: $spacing-6;
      }

      &__actions {
        display: flex;
        justify-content: flex-end;
        gap: $spacing-3;
      }
    }

    .btn-danger {
      --mdc-filled-button-container-color: #{$danger};
      --mdc-filled-button-label-text-color: #{$text-inverse};
    }

    .btn-warning {
      --mdc-filled-button-container-color: #{$warning};
      --mdc-filled-button-label-text-color: #{$text-primary};
    }

    .btn-info {
      --mdc-filled-button-container-color: #{$primary};
      --mdc-filled-button-label-text-color: #{$text-inverse};
    }
  `],
})
export class ConfirmDialogComponent {
  readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly loading = signal(false);

  getIcon(): string {
    switch (this.data.type) {
      case 'danger': return 'error_outline';
      case 'warning': return 'warning_amber';
      default: return 'info';
    }
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
