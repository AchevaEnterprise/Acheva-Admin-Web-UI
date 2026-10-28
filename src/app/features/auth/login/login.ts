import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = signal(false);
  showPassword = signal(false);

  togglePasswordVisibility(): void {
    this.showPassword.update((shown) => !shown);
  }

  /** Only surface a field error once the user has interacted with it. */
  showError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth
      .signIn(email, password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (err: { status?: number; error?: { message?: unknown } }) => {
          // Unknown email (404) and wrong password (400) read the same — the
          // raw 404 text was "user not found with info: <email>", which told
          // a stranger which addresses are admins.
          const message = err?.error?.message;
          if (err?.status === 404 || err?.status === 400) {
            this.toast.error('Incorrect email or password.');
          } else if (err?.status === 429) {
            this.toast.error('Too many attempts. Wait a minute, then try again.');
          } else if (err?.status === 0) {
            this.toast.error('Could not reach Acheva. Check your connection and try again.');
          } else {
            this.toast.error(typeof message === 'string' ? message : 'Sign in failed.');
          }
        },
      });
  }
}
