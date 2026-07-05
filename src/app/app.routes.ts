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
