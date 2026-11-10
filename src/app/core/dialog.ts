import { MatDialogConfig } from '@angular/material/dialog';

/**
 * For detail views and longer forms. Material caps a dialog at 560px unless
 * told otherwise, and content wider than that is clipped, not wrapped.
 */
export const WIDE_DIALOG: MatDialogConfig = { width: '640px', maxWidth: '92vw' };
