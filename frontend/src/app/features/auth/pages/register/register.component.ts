import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
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

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <div class="register">
      <!-- Mobile Logo -->
      <div class="register__mobile-brand">
        <div class="register__logo" style="background: transparent;">
          <img src="logo.jpg" alt="Logo" style="width: 56px; height: 56px; border-radius: inherit; object-fit: cover;">
        </div>
        <h2>CivicPulse</h2>
      </div>

      <div class="register__card">
        <div class="register__header">
          <h2 class="register__title">Create Account</h2>
          <p class="register__subtitle">Join our community and start reporting issues</p>
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register__form">
          <div class="register__row">
            <mat-form-field appearance="outline">
              <mat-label>First Name</mat-label>
              <input matInput formControlName="firstName" placeholder="John" autocomplete="given-name" />
              <mat-icon matPrefix>person</mat-icon>
              @if (registerForm.get('firstName')?.hasError('required') && registerForm.get('firstName')?.touched) {
                <mat-error>First name is required</mat-error>
              }
              @if (registerForm.get('firstName')?.hasError('minlength') && registerForm.get('firstName')?.touched) {
                <mat-error>Minimum 2 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Last Name</mat-label>
              <input matInput formControlName="lastName" placeholder="Doe" autocomplete="family-name" />
              <mat-icon matPrefix>person</mat-icon>
              @if (registerForm.get('lastName')?.hasError('required') && registerForm.get('lastName')?.touched) {
                <mat-error>Last name is required</mat-error>
              }
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Email Address</mat-label>
            <input matInput formControlName="email" type="email" placeholder="you&#64;example.com" autocomplete="email" />
            <mat-icon matPrefix>email</mat-icon>
            @if (registerForm.get('email')?.hasError('required') && registerForm.get('email')?.touched) {
              <mat-error>Email is required</mat-error>
            }
            @if (registerForm.get('email')?.hasError('email') && registerForm.get('email')?.touched) {
              <mat-error>Please enter a valid email</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Phone (Optional)</mat-label>
            <input matInput formControlName="phone" placeholder="+1 234 567 8900" autocomplete="tel" />
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (registerForm.get('password')?.hasError('required') && registerForm.get('password')?.touched) {
              <mat-error>Password is required</mat-error>
            }
            @if (registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched) {
              <mat-error>Minimum 8 characters</mat-error>
            }
            @if (registerForm.get('password')?.hasError('pattern') && registerForm.get('password')?.touched) {
              <mat-error>Must include uppercase, lowercase, number & special character</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirm Password</mat-label>
            <input
              matInput
              formControlName="confirmPassword"
              [type]="showConfirmPassword() ? 'text' : 'password'"
              placeholder="Re-enter password"
              autocomplete="new-password"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="showConfirmPassword.set(!showConfirmPassword())">
              <mat-icon>{{ showConfirmPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (registerForm.get('confirmPassword')?.hasError('required') && registerForm.get('confirmPassword')?.touched) {
              <mat-error>Please confirm your password</mat-error>
            }
            @if (registerForm.get('confirmPassword')?.hasError('passwordMismatch') && registerForm.get('confirmPassword')?.touched) {
              <mat-error>Passwords do not match</mat-error>
            }
          </mat-form-field>

          <mat-checkbox formControlName="acceptTerms" color="primary" class="register__terms">
            I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
          </mat-checkbox>
          @if (registerForm.get('acceptTerms')?.hasError('requiredTrue') && registerForm.get('acceptTerms')?.touched) {
            <p class="register__terms-error">You must accept the terms to continue</p>
          }

          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="register__submit-btn"
            [disabled]="isSubmitting()"
          >
            @if (isSubmitting()) {
              <mat-spinner diameter="20" color="accent"></mat-spinner>
              <span>Creating Account...</span>
            } @else {
              <span>Create Account</span>
            }
          </button>
        </form>

        <div class="register__footer">
          <p>Already have an account?
            <a [routerLink]="['/', routePaths.auth.root, routePaths.auth.login]">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .register {
      &__mobile-brand {
        @include flex-column-center;
        gap: $spacing-2;
        margin-bottom: $spacing-6;

        @include lg {
          display: none;
        }

        .register__logo {
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
          padding: $spacing-5;
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

      &__row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: $spacing-3;

        @include xs {
          grid-template-columns: 1fr;
          gap: 0;
        }
      }

      &__terms {
        margin-bottom: $spacing-4;
        font-size: $font-size-sm;

        a {
          color: $primary;
          font-weight: $font-weight-medium;
        }
      }

      &__terms-error {
        font-size: $font-size-xs;
        color: $danger;
        margin-top: -$spacing-3;
        margin-bottom: $spacing-3;
      }

      &__submit-btn {
        height: 48px;
        font-size: $font-size-base;
        font-weight: $font-weight-semibold;
        border-radius: $radius-md;

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
export class RegisterComponent {
  readonly routePaths = ROUTE_PATHS;
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isSubmitting = signal(false);

  registerForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
      ]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    });

    // Cross-field validation for password match
    this.registerForm.get('confirmPassword')?.addValidators(
      this.passwordMatchValidator.bind(this)
    );
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { firstName, lastName, email, phone, password, confirmPassword } = this.registerForm.value;

    this.authService.register({ firstName, lastName, email, phone, password, confirmPassword }).subscribe({
      next: () => {
        this.notification.success('Account created successfully!');
        this.router.navigate(['/', ROUTE_PATHS.dashboard]);
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = this.registerForm?.get('password')?.value;
    if (password !== control.value) {
      return { passwordMismatch: true };
    }
    return null;
  }
}
