import { Routes } from '@angular/router';
import { ROUTE_PATHS } from './core/constants/route.constants';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { officerGuard } from './core/guards/officer.guard';
import { fieldWorkerGuard } from './core/guards/field-worker.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTE_PATHS.dashboard,
    pathMatch: 'full',
  },
  {
    path: ROUTE_PATHS.auth.root,
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: ROUTE_PATHS.dashboard,
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Dashboard - CivicPulse',
      },
      {
        path: ROUTE_PATHS.report,
        loadComponent: () =>
          import('./features/complaints/pages/complaint-submit/complaint-submit.component').then(
            (m) => m.ComplaintSubmitComponent,
          ),
        title: 'Report Incident - CivicPulse',
      },
      {
        path: ROUTE_PATHS.complaints.root,
        loadComponent: () =>
          import('./features/complaints/pages/complaint-list/complaint-list.component').then(
            (m) => m.ComplaintListComponent,
          ),
        title: 'My Complaints - CivicPulse',
      },
      {
        path: `${ROUTE_PATHS.complaints.root}/${ROUTE_PATHS.complaints.details}`,
        loadComponent: () =>
          import('./features/complaints/pages/complaint-details/complaint-details.component').then(
            (m) => m.ComplaintDetailsComponent,
          ),
        title: 'Incident Details - CivicPulse',
      },
      {
        path: ROUTE_PATHS.profile,
        loadComponent: () =>
          import('./features/profile/pages/profile-edit/profile-edit.component').then(
            (m) => m.ProfileEditComponent,
          ),
        title: 'My Profile - CivicPulse',
      },
      {
        path: ROUTE_PATHS.settings,
        loadComponent: () =>
          import('./features/settings/pages/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
        title: 'Account Settings - CivicPulse',
      },
      {
        path: ROUTE_PATHS.notifications,
        loadComponent: () =>
          import('./features/settings/pages/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
        title: 'Notifications - CivicPulse',
      },
      {
        path: ROUTE_PATHS.help,
        loadComponent: () =>
          import('./features/settings/pages/help/help.component').then((m) => m.HelpComponent),
        title: 'Help & Support - CivicPulse',
      },
      {
        path: ROUTE_PATHS.about,
        loadComponent: () =>
          import('./features/settings/pages/about/about.component').then((m) => m.AboutComponent),
        title: 'About CivicPulse AI',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
        title: 'Platform Control - CivicPulse',
      },
      {
        path: 'officer',
        canActivate: [officerGuard],
        loadChildren: () =>
          import('./features/officer/officer.routes').then((m) => m.OFFICER_ROUTES),
        title: 'Officer Portal - CivicPulse',
      },
      {
        path: 'field-worker',
        canActivate: [fieldWorkerGuard],
        loadChildren: () =>
          import('./features/field-worker/field-worker.routes').then((m) => m.FIELD_WORKER_ROUTES),
        title: 'Field Worker Portal - CivicPulse',
      },
      {
        path: 'analytics',
        redirectTo: 'admin/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: '404 - Page Not Found',
  },
];
