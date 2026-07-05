import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ISchool } from '../../core/models/admin.model';

export interface ISchoolDialogResult {
  name: string;
  acronym?: string;
  address?: string;
}

/** Create/Edit School — mirrors the Figma modal (logo storage lands later). */
@Component({
  selector: 'app-school-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>{{ school ? 'Edit School' : 'Create School' }}</h2>
      <p>Enter the details of the institution to register it in the system</p>

      <label>
        School Name
        <input
          class="adm-input"
          formControlName="name"
          placeholder="e.g Federal University of Technology, Owerri"
        />
      </label>

      <label>
        School Acronym
        <input class="adm-input" formControlName="acronym" placeholder="e.g FUTO" />
      </label>

      <label>
        Location
        <input class="adm-input" formControlName="address" placeholder="e.g Owerri, Imo" />
      </label>

      <label>
        School Logo
        <span class="school-dialog__dropzone">
          Logo upload arrives with file storage (S3/Cloudinary) — coming soon.
        </span>
      </label>

      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">
          Cancel
        </button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid">
          {{ school ? 'Save Changes' : 'Create School' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .school-dialog__dropzone {
      border: 1.5px dashed #d1d5db;
      border-radius: 10px;
      padding: 28px 16px;
      text-align: center;
      color: #9ca3af;
      font-weight: 400;
      font-size: 0.8125rem;
    }
  `,
})
export class SchoolDialog {
  readonly ref = inject(MatDialogRef<SchoolDialog, ISchoolDialogResult>);
  readonly school = inject<ISchool | null>(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.school?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    acronym: new FormControl(this.school?.acronym ?? '', { nonNullable: true }),
    address: new FormControl(this.school?.address ?? '', { nonNullable: true }),
  });

  save(): void {
    if (this.form.invalid) return;
    const { name, acronym, address } = this.form.getRawValue();
    this.ref.close({
      name: name.trim(),
      acronym: acronym.trim() || undefined,
      address: address.trim() || undefined,
    });
  }
}
