import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLES } from '../constants/app.constants';
import { ROUTE_PATHS } from '../constants/route.constants';

export const officerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.userRole() === ROLES.OFFICER) {
    return true;
  }

  router.navigate(['/', ROUTE_PATHS.dashboard]);
  return false;
};
