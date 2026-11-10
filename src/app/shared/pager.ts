import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** "Showing 21–40 of 134" with Previous / Next. */
@Component({
  selector: 'app-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <nav class="adm-pager" aria-label="Pages">
        <span>Showing {{ first() }}–{{ last() }} of {{ total() }}</span>
        <span class="adm-pager__buttons">
          <button
            type="button"
            class="adm-btn adm-btn--outline"
            [disabled]="page() <= 1"
            (click)="pageChange.emit(page() - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="adm-btn adm-btn--outline"
            [disabled]="last() >= total()"
            (click)="pageChange.emit(page() + 1)"
          >
            Next
          </button>
        </span>
      </nav>
    }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly limit = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly first = computed(() => (this.page() - 1) * this.limit() + 1);
  readonly last = computed(() => Math.min(this.page() * this.limit(), this.total()));
}
