import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (req.url.includes('/auth/admins/login')) return next(req);
  const token = auth.token;
  return next(
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req,
  );
};
