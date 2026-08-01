import { Routes } from '@angular/router';

export const FIELD_WORKER_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/worker-dashboard/worker-dashboard.component').then(
        (m) => m.WorkerDashboardComponent,
      ),
  },
];
