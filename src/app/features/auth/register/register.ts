import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/** Invite redemption: /register?token=…&email=… → account → auto sign-in. */
@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
})
export class Register implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = signal(false);
  token = signal('');

  form = new FormGroup({
    firstname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    lastname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.token.set(params.get('token') ?? '');
    const email = params.get('email');
    if (email) this.form.controls.email.setValue(email);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.toast.error('Passwords do not match.');
      return;
    }
    this.loading.set(true);
    this.api
      .registerWithInvite({ ...value, inviteToken: this.token() })
      .subscribe({
        next: () => {
          // Auto sign-in with the fresh credentials.
          this.auth
            .signIn(value.email, value.password)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
              next: () => void this.router.navigate(['/dashboard']),
              error: () => void this.router.navigate(['/login']),
            });
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.toast.error(err?.error?.message ?? 'Registration failed.');
        },
      });
  }
}
