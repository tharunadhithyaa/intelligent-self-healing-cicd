import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';

@Component({
  selector: 'app-forgot-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <div class="forgot-password">
      <div class="forgot-password__mobile-brand">
        <div class="forgot-password__logo" style="background: transparent;">
          <img src="logo.jpg" alt="Logo" style="width: 56px; height: 56px; border-radius: inherit; object-fit: cover;">
        </div>
        <h2>CivicPulse</h2>
      </div>

      <div class="forgot-password__card">
        @if (!emailSent()) {
          <div class="forgot-password__header">
            <div class="forgot-password__icon-wrapper">
              <mat-icon>lock_reset</mat-icon>
            </div>
            <h2 class="forgot-password__title">Forgot Password?</h2>
            <p class="forgot-password__subtitle">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
          </div>

          <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()" class="forgot-password__form">
            <mat-form-field appearance="outline">
              <mat-label>Email Address</mat-label>
              <input matInput formControlName="email" type="email" placeholder="you&#64;example.com" autocomplete="email" />
              <mat-icon matPrefix>email</mat-icon>
              @if (forgotForm.get('email')?.hasError('required') && forgotForm.get('email')?.touched) {
                <mat-error>Email is required</mat-error>
              }
              @if (forgotForm.get('email')?.hasError('email') && forgotForm.get('email')?.touched) {
                <mat-error>Please enter a valid email</mat-error>
              }
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="forgot-password__submit-btn"
              [disabled]="isSubmitting()"
            >
              @if (isSubmitting()) {
                <mat-spinner diameter="20" color="accent"></mat-spinner>
                <span>Sending...</span>
              } @else {
                <span>Send Reset Link</span>
              }
            </button>
          </form>
        } @else {
          <!-- Success State -->
          <div class="forgot-password__success">
            <div class="forgot-password__success-icon">
              <mat-icon>mark_email_read</mat-icon>
            </div>
            <h2 class="forgot-password__title">Check Your Email</h2>
            <p class="forgot-password__subtitle">
              If an account with that email exists, we've sent password reset instructions.
              Please check your inbox and spam folder.
            </p>
            <button
              mat-stroked-button
              color="primary"
              (click)="emailSent.set(false)"
              class="forgot-password__resend-btn"
            >
              Didn't receive it? Try again
            </button>
          </div>
        }

        <div class="forgot-password__footer">
          <a [routerLink]="['/', routePaths.auth.root, routePaths.auth.login]">
            <mat-icon>arrow_back</mat-icon>
            <span>Back to Sign In</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .forgot-password {
      &__mobile-brand {
        @include flex-column-center;
        gap: $spacing-2;
        margin-bottom: $spacing-8;

        @include lg { display: none; }

        .forgot-password__logo {
          @include flex-center;
          width: 56px;
          height: 56px;
          border-radius: $radius-xl;
          background: $gradient-primary;

          mat-icon { color: $text-inverse; font-size: 28px; width: 28px; height: 28px; }
        }

        h2 { font-size: $font-size-2xl; color: $text-primary; }
      }

      &__card {
        @include card-base;
        padding: $spacing-8;

        @include mobile-only { padding: $spacing-6; }
      }

      &__header {
        text-align: center;
        margin-bottom: $spacing-6;
      }

      &__icon-wrapper {
        @include flex-center;
        width: 64px;
        height: 64px;
        border-radius: $radius-full;
        background: $primary-light;
        margin: 0 auto $spacing-4;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: $primary;
        }
      }

      &__title {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;
        color: $text-primary;
        margin-bottom: $spacing-2;
      }

      &__subtitle {
        font-size: $font-size-base;
        color: $text-secondary;
        line-height: $line-height-relaxed;
        max-width: 380px;
        margin: 0 auto;
      }

      &__form {
        display: flex;
        flex-direction: column;
        gap: $spacing-3;
      }

      &__submit-btn {
        height: 48px;
        font-size: $font-size-base;
        font-weight: $font-weight-semibold;
        border-radius: $radius-md;

        mat-spinner { display: inline-block; margin-right: $spacing-2; }
      }

      &__success {
        text-align: center;
        padding: $spacing-4 0;
      }

      &__success-icon {
        @include flex-center;
        width: 72px;
        height: 72px;
        border-radius: $radius-full;
        background: $primary-light;
        margin: 0 auto $spacing-4;

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          color: $primary;
        }
      }

      &__resend-btn {
        margin-top: $spacing-6;
      }

      &__footer {
        text-align: center;
        margin-top: $spacing-6;
        padding-top: $spacing-6;
        border-top: 1px solid $border-light;

        a {
          @include flex-center;
          gap: $spacing-2;
          font-size: $font-size-sm;
          color: $text-secondary;
          font-weight: $font-weight-medium;

          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &:hover { color: $primary; text-decoration: none; }
        }
      }
    }
  `],
})
export class ForgotPasswordComponent {
  readonly routePaths = ROUTE_PATHS;
  readonly isSubmitting = signal(false);
  readonly emailSent = signal(false);

  forgotForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly notification: NotificationService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { email } = this.forgotForm.value;

    this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.emailSent.set(true);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }
}
