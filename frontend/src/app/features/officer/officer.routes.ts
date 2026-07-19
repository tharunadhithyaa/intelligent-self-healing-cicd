import { Routes } from '@angular/router';

export const OFFICER_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/officer-dashboard/officer-dashboard.component').then(
        (m) => m.OfficerDashboardComponent
      )
  },
  {
    path: 'complaints',
    loadComponent: () =>
      import('./pages/officer-complaints-list/officer-complaints-list.component').then(
        (m) => m.OfficerComplaintsListComponent
      )
  },
  {
    path: 'complaints/:id',
    loadComponent: () =>
      import('./pages/officer-complaint-details/officer-complaint-details.component').then(
        (m) => m.OfficerComplaintDetailsComponent
      )
  }
];
