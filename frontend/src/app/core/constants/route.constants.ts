export const ROUTE_PATHS = {
  auth: {
    root: 'auth',
    login: 'login',
    register: 'register',
    forgotPassword: 'forgot-password',
    resetPassword: 'reset-password',
  },
  dashboard: 'dashboard',
  report: 'report',
  complaints: {
    root: 'complaints',
    list: '',
    details: ':id',
  },
  settings: 'settings',
  profile: 'profile',
  notifications: 'notifications',
  help: 'help',
  about: 'about',
  notFound: '404',
} as const;
