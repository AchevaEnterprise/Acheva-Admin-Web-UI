import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'schools',
        loadComponent: () =>
          import('./features/schools/schools').then((m) => m.Schools),
      },
      {
        path: 'faculty',
        loadComponent: () =>
          import('./features/faculties/faculties').then((m) => m.Faculties),
      },
      {
        path: 'department',
        loadComponent: () =>
          import('./features/departments/departments').then((m) => m.Departments),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./features/courses/courses').then((m) => m.Courses),
      },
      {
        path: 'admins',
        loadComponent: () =>
          import('./features/admins/admins').then((m) => m.Admins),
      },
      {
        path: 'registration',
        loadComponent: () =>
          import('./features/registration/registration').then(
            (m) => m.RegistrationSettings,
          ),
      },
      {
        path: 'school-fees',
        loadComponent: () =>
          import('./features/school-fees/school-fees').then((m) => m.SchoolFees),
      },
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees').then((m) => m.Fees),
      },
      {
        path: 'support',
        // Two panes that scroll internally — see `Layout.fullBleed`.
        data: { fullBleed: true },
        loadComponent: () =>
          import('./features/support/support').then((m) => m.Support),
      },
      {
        path: 'lecturers',
        loadComponent: () =>
          import('./features/lecturers/lecturers').then((m) => m.Lecturers),
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./features/students/students').then((m) => m.Students),
      },
      {
        path: 'logs',
        loadComponent: () => import('./features/logs/logs').then((m) => m.Logs),
      },
      {
        path: 'logs/:id',
        loadComponent: () =>
          import('./features/logs/ticket-detail').then((m) => m.TicketDetail),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
      {
        path: ':stub',
        loadComponent: () => import('./features/stub/stub').then((m) => m.Stub),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
