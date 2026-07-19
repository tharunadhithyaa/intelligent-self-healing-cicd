import { Component, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';

@Component({
  selector: 'app-reset-password',
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
    <div class="reset-password">
      <div class="reset-password__mobile-brand">
        <div class="reset-password__logo" style="background: transparent;">
          <img src="logo.jpg" alt="Logo" style="width: 56px; height: 56px; border-radius: inherit; object-fit: cover;">
        </div>
        <h2>CivicPulse</h2>
      </div>

      <div class="reset-password__card">
        @if (!resetComplete()) {
          <div class="reset-password__header">
            <div class="reset-password__icon-wrapper">
              <mat-icon>vpn_key</mat-icon>
            </div>
            <h2 class="reset-password__title">Set New Password</h2>
            <p class="reset-password__subtitle">
              Your new password must be at least 8 characters and include uppercase, lowercase, number, and special character.
            </p>
          </div>

          <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="reset-password__form">
            <mat-form-field appearance="outline">
              <mat-label>New Password</mat-label>
              <input
                matInput
                formControlName="password"
                [type]="showPassword() ? 'text' : 'password'"
                placeholder="Enter new password"
                autocomplete="new-password"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (resetForm.get('password')?.hasError('required') && resetForm.get('password')?.touched) {
                <mat-error>Password is required</mat-error>
              }
              @if (resetForm.get('password')?.hasError('minlength') && resetForm.get('password')?.touched) {
                <mat-error>Minimum 8 characters</mat-error>
              }
              @if (resetForm.get('password')?.hasError('pattern') && resetForm.get('password')?.touched) {
                <mat-error>Must include uppercase, lowercase, number & special character</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirm New Password</mat-label>
              <input
                matInput
                formControlName="confirmPassword"
                [type]="showConfirmPassword() ? 'text' : 'password'"
                placeholder="Re-enter new password"
                autocomplete="new-password"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="showConfirmPassword.set(!showConfirmPassword())">
                <mat-icon>{{ showConfirmPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (resetForm.get('confirmPassword')?.hasError('required') && resetForm.get('confirmPassword')?.touched) {
                <mat-error>Please confirm your password</mat-error>
              }
              @if (resetForm.get('confirmPassword')?.hasError('passwordMismatch') && resetForm.get('confirmPassword')?.touched) {
                <mat-error>Passwords do not match</mat-error>
              }
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="reset-password__submit-btn"
              [disabled]="isSubmitting()"
            >
              @if (isSubmitting()) {
                <mat-spinner diameter="20" color="accent"></mat-spinner>
                <span>Resetting...</span>
              } @else {
                <span>Reset Password</span>
              }
            </button>
          </form>
        } @else {
          <div class="reset-password__success">
            <div class="reset-password__success-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h2 class="reset-password__title">Password Reset!</h2>
            <p class="reset-password__subtitle">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <a
              mat-flat-button
              color="primary"
              [routerLink]="['/', routePaths.auth.root, routePaths.auth.login]"
              class="reset-password__login-btn"
            >
              Go to Sign In
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .reset-password {
      &__mobile-brand {
        @include flex-column-center;
        gap: $spacing-2;
        margin-bottom: $spacing-8;
        @include lg { display: none; }

        .reset-password__logo {
          @include flex-center;
          width: 56px; height: 56px;
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

      &__header { text-align: center; margin-bottom: $spacing-6; }

      &__icon-wrapper {
        @include flex-center;
        width: 64px; height: 64px;
        border-radius: $radius-full;
        background: $primary-light;
        margin: 0 auto $spacing-4;
        mat-icon { font-size: 32px; width: 32px; height: 32px; color: $primary; }
      }

      &__title {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;
        color: $text-primary;
        margin-bottom: $spacing-2;
      }

      &__subtitle {
        font-size: $font-size-sm;
        color: $text-secondary;
        line-height: $line-height-relaxed;
        max-width: 380px;
        margin: 0 auto;
      }

      &__form { display: flex; flex-direction: column; gap: $spacing-1; }

      &__submit-btn {
        height: 48px;
        font-size: $font-size-base;
        font-weight: $font-weight-semibold;
        border-radius: $radius-md;
        margin-top: $spacing-2;
        mat-spinner { display: inline-block; margin-right: $spacing-2; }
      }

      &__success { text-align: center; padding: $spacing-4 0; }

      &__success-icon {
        @include flex-center;
        width: 72px; height: 72px;
        border-radius: $radius-full;
        background: $primary-light;
        margin: 0 auto $spacing-4;
        mat-icon { font-size: 36px; width: 36px; height: 36px; color: $primary; }
      }

      &__login-btn { margin-top: $spacing-6; }
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  readonly routePaths = ROUTE_PATHS;
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly resetComplete = signal(false);

  private token = '';
  resetForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notification: NotificationService
  ) {
    this.resetForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
      ]],
      confirmPassword: ['', [Validators.required]],
    });

    this.resetForm.get('confirmPassword')?.addValidators(
      this.passwordMatchValidator.bind(this)
    );
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.notification.error('Invalid or missing reset token.');
      this.router.navigate(['/', ROUTE_PATHS.auth.root, ROUTE_PATHS.auth.login]);
    }
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { password, confirmPassword } = this.resetForm.value;

    this.authService.resetPassword({ token: this.token, password, confirmPassword }).subscribe({
      next: () => {
        this.resetComplete.set(true);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = this.resetForm?.get('password')?.value;
    if (password !== control.value) {
      return { passwordMismatch: true };
    }
    return null;
  }
}
