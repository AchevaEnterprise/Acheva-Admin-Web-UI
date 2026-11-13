import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { achevaEmailValidator, isAchevaEmail } from '../../../core/acheva-email';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/** The server's `IsStrongPassword` defaults, one line each. */
const PASSWORD_RULES = [
  { id: 'length', label: '8 or more characters', test: (v: string) => v.length >= 8 },
  { id: 'case', label: 'Upper and lower case', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'number', label: 'A number', test: (v: string) => /\d/.test(v) },
  { id: 'symbol', label: 'A symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  return PASSWORD_RULES.every((rule) => rule.test(value)) ? null : { weakPassword: true };
}

type Field = 'firstname' | 'lastname' | 'email' | 'password' | 'confirmPassword';

/** Invite redemption: /register?token=…&email=… → account → auto sign-in. */
@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './register.html',
  styleUrls: ['../login/login.scss', './register.scss'],
})
export class Register implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = signal(false);
  token = signal('');
  /** The address the invite was issued to — shown, not typed. */
  invitedEmail = signal('');
  showPassword = signal(false);
  showConfirm = signal(false);

  /**
   * An invite issued before the Acheva-domain rule (2026-11-11) can still be
   * in someone's inbox; say so up front rather than at the end of the form.
   */
  invitedEmailRefused = computed(
    () => !!this.invitedEmail() && !isAchevaEmail(this.invitedEmail()),
  );

  form = new FormGroup({
    firstname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(20)],
    }),
    lastname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(20)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, achevaEmailValidator],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, strongPassword],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly rules = computed(() => {
    const password = this.values().password ?? '';
    return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
  });

  readonly mismatch = computed(() => {
    const { password, confirmPassword } = this.values();
    return !!confirmPassword && password !== confirmPassword;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.token.set(params.get('token') ?? '');
    const email = (params.get('email') ?? '').trim().toLowerCase();
    if (email) {
      this.invitedEmail.set(email);
      this.form.controls.email.setValue(email);
    }
  }

  /** Only surface a field error once the user has interacted with it. */
  showError(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  emailError(): string {
    return this.form.controls.email.hasError('achevaEmail')
      ? 'Use your @acheva.app address.'
      : 'Enter the email your invite was sent to.';
  }

  submit(): void {
    if (this.invitedEmailRefused()) return;
    if (this.form.invalid || this.mismatch()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
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
        error: (err: { error?: { message?: unknown } }) => {
          this.loading.set(false);
          // Validation failures arrive as an array of messages.
          const message = err?.error?.message;
          const text = Array.isArray(message) ? message[0] : message;
          this.toast.error(typeof text === 'string' ? text : 'Registration failed.');
        },
      });
  }
}
