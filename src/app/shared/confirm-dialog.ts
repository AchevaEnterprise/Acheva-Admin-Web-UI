import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface IConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-dialog">
      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close(false)">
          Cancel
        </button>
        <button
          type="button"
          class="adm-btn"
          [class.adm-btn--danger]="data.destructive"
          (click)="ref.close(true)"
        >
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  readonly ref = inject(MatDialogRef<ConfirmDialog, boolean>);
  readonly data = inject<IConfirmData>(MAT_DIALOG_DATA);
}
