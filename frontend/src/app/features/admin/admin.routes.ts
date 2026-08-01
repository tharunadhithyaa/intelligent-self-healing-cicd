import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/user-management/user-management.component').then(
        (m) => m.UserManagementComponent,
      ),
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./pages/department-management/department-management.component').then(
        (m) => m.DepartmentManagementComponent,
      ),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/report-generation/report-generation.component').then(
        (m) => m.ReportGenerationComponent,
      ),
  },
  {
    path: 'audit-logs',
    loadComponent: () =>
      import('./pages/audit-logs/audit-logs.component').then((m) => m.AuditLogsComponent),
  },
  {
    path: 'roles-broadcast',
    loadComponent: () =>
      import('./pages/role-broadcast/role-broadcast.component').then(
        (m) => m.RoleBroadcastComponent,
      ),
  },
];
