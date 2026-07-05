import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import { IAdminProfile } from '../models/admin.model';

const TOKEN_KEY = 'acheva-admin-token';
const ACCOUNT_KEY = 'acheva-admin-account';

interface ISignInResponse extends IAdminProfile {
  accessToken: string;
  refreshToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly jwt = new JwtHelperService();

  readonly account = signal<IAdminProfile | null>(null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get isAuthenticated(): boolean {
    const token = this.token;
    return !!token && !this.jwt.isTokenExpired(token);
  }

  signIn(email: string, password: string): Observable<IAPIResponse<ISignInResponse>> {
    return this.http
      .post<IAPIResponse<ISignInResponse>>(`${environment.BASE_URL}/auth/admins/login`, {
        email,
        password,
      })
      .pipe(
        tap((resp) => {
          const { accessToken, refreshToken: _refresh, ...profile } = resp.data;
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(ACCOUNT_KEY, JSON.stringify(profile));
          this.account.set(profile);
        }),
      );
  }

  loadInitialSession(): void {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (raw) this.account.set(JSON.parse(raw) as IAdminProfile);
  }

  signOut(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    this.account.set(null);
    void this.router.navigate(['/login']);
  }
}
