import { Routes } from '@angular/router';
import { ROUTE_PATHS } from '../../core/constants/route.constants';

export const AUTH_ROUTES: Routes = [
  {
    path: ROUTE_PATHS.auth.login,
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign In - CivicPulse',
  },
  {
    path: ROUTE_PATHS.auth.register,
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
    title: 'Create Account - CivicPulse',
  },
  {
    path: ROUTE_PATHS.auth.forgotPass,
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
    title: 'Forgot Password - CivicPulse',
  },
  {
    path: ROUTE_PATHS.auth.resetPass,
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Reset Password - CivicPulse',
  },
  {
    path: '',
    redirectTo: ROUTE_PATHS.auth.login,
    pathMatch: 'full',
  },
];
