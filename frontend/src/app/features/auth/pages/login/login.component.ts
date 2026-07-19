import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ROUTE_PATHS } from '../../../../core/constants/route.constants';
import { AutoFocusDirective } from '../../../../shared/directives/auto-focus.directive';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    RouterLink,
    AutoFocusDirective,
  ],
  template: `
    <div class="login">
      <!-- Mobile Logo -->
      <div class="login__mobile-brand">
        <div class="login__logo" style="background: transparent;">
          <img src="logo.jpg" alt="Logo" style="width: 56px; height: 56px; border-radius: inherit; object-fit: cover;">
        </div>
        <h2>CivicPulse</h2>
      </div>

      <div class="login__card">
        <div class="login__header">
          <h2 class="login__title">Welcome Back</h2>
          <p class="login__subtitle">Sign in to your account to continue</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login__form">
          <mat-form-field appearance="outline">
            <mat-label>Email Address</mat-label>
            <input
              matInput
              formControlName="email"
              type="email"
              placeholder="you&#64;example.com"
              appAutoFocus
              autocomplete="email"
            />
            <mat-icon matPrefix>email</mat-icon>
            @if (loginForm.get('email')?.hasError('required') && loginForm.get('email')?.touched) {
              <mat-error>Email is required</mat-error>
            }
            @if (loginForm.get('email')?.hasError('email') && loginForm.get('email')?.touched) {
              <mat-error>Please enter a valid email</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              placeholder="Enter your password"
              autocomplete="current-password"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="showPassword.set(!showPassword())"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
              <mat-error>Password is required</mat-error>
            }
          </mat-form-field>

          <div class="login__options">
            <mat-checkbox formControlName="rememberMe" color="primary">
              Remember me
            </mat-checkbox>
            <a
              class="login__forgot-link"
              [routerLink]="['/', routePaths.auth.root, routePaths.auth.forgotPassword]"
            >
              Forgot password?
            </a>
          </div>

          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="login__submit-btn"
            [disabled]="isSubmitting()"
          >
            @if (isSubmitting()) {
              <mat-spinner diameter="20" color="accent"></mat-spinner>
              <span>Signing in...</span>
            } @else {
              <span>Sign In</span>
            }
          </button>
        </form>

        <div class="login__footer">
          <p>Don't have an account?
            <a [routerLink]="['/', routePaths.auth.root, routePaths.auth.register]">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .login {
      &__mobile-brand {
        @include flex-column-center;
        gap: $spacing-2;
        margin-bottom: $spacing-8;

        @include lg {
          display: none;
        }

        .login__logo {
          @include flex-center;
          width: 56px;
          height: 56px;
          border-radius: $radius-xl;
          background: $gradient-primary;

          mat-icon {
            color: $text-inverse;
            font-size: 28px;
            width: 28px;
            height: 28px;
          }
        }

        h2 {
          font-size: $font-size-2xl;
          color: $text-primary;
        }
      }

      &__card {
        @include card-base;
        padding: $spacing-8;

        @include mobile-only {
          padding: $spacing-6;
        }
      }

      &__header {
        margin-bottom: $spacing-6;
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
      }

      &__form {
        display: flex;
        flex-direction: column;
        gap: $spacing-1;
      }

      &__options {
        @include flex-between;
        margin-bottom: $spacing-4;
        flex-wrap: wrap;
        gap: $spacing-2;
      }

      &__forgot-link {
        font-size: $font-size-sm;
        color: $primary;
        font-weight: $font-weight-medium;

        &:hover {
          color: $primary-hover;
        }
      }

      &__submit-btn {
        height: 48px;
        font-size: $font-size-base;
        font-weight: $font-weight-semibold;
        border-radius: $radius-md;
        margin-bottom: $spacing-2;

        mat-spinner {
          display: inline-block;
          margin-right: $spacing-2;
        }
      }

      &__footer {
        text-align: center;
        margin-top: $spacing-6;
        padding-top: $spacing-6;
        border-top: 1px solid $border-light;

        p {
          font-size: $font-size-sm;
          color: $text-secondary;
        }

        a {
          color: $primary;
          font-weight: $font-weight-semibold;
        }
      }
    }
  `],
})
export class LoginComponent {
  readonly routePaths = ROUTE_PATHS;
  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);

  loginForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { email, password, rememberMe } = this.loginForm.value;

    this.authService.login({ email, password }, rememberMe).subscribe({
      next: () => {
        this.notification.success('Welcome back!');
        this.router.navigate(['/', ROUTE_PATHS.dashboard]);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }
}
