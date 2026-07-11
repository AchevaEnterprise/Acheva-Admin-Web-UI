import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * A single shimmering skeleton block — the primitive for all loading states.
 * Compose several to mirror the real content (text lines, cards, table rows)
 * instead of a spinner.
 *
 * @example <app-skeleton width="40%" height="1rem" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `
    :host {
      display: block;
      background: linear-gradient(100deg, #e9edf2 30%, #f4f7fa 50%, #e9edf2 70%);
      background-size: 200% 100%;
      animation: adm-skeleton-shimmer 1.3s ease-in-out infinite;
    }

    @keyframes adm-skeleton-shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
  host: {
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': "circle() ? '50%' : radius()",
    'aria-hidden': 'true',
  },
})
export class Skeleton {
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly radius = input<string>('8px');
  readonly circle = input<boolean>(false);
}

/**
 * A table-shaped loading placeholder — a header strip plus `rows` × `cols`
 * shimmer cells. Drop it in wherever an `.adm-table` is being fetched.
 *
 * @example <app-skeleton-table [rows]="6" [cols]="4" />
 */
@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    <div class="sk-table" aria-hidden="true">
      <div class="sk-table__head">
        @for (col of cols_(); track col) {
          <app-skeleton width="60%" height="0.7rem" />
        }
      </div>
      @for (row of rows_(); track row) {
        <div class="sk-table__row">
          @for (col of cols_(); track col) {
            <app-skeleton width="80%" height="1rem" />
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sk-table {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }

    .sk-table__head,
    .sk-table__row {
      display: grid;
      grid-template-columns: repeat(var(--sk-cols, 4), 1fr);
      gap: 1rem;
      align-items: center;
    }

    .sk-table__head {
      padding-bottom: 0.85rem;
      border-bottom: 1px solid #eef1f5;
    }

    .sk-table__row {
      padding: 0.4rem 0;
    }
  `,
  host: {
    '[style.--sk-cols]': 'cols()',
  },
})
export class SkeletonTable {
  readonly rows = input<number>(6);
  readonly cols = input<number>(4);

  protected readonly rows_ = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i),
  );
  protected readonly cols_ = computed(() =>
    Array.from({ length: this.cols() }, (_, i) => i),
  );
}
