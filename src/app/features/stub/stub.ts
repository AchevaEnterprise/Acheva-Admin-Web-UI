import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Placeholder for nav items whose management pages arrive in later rounds. */
@Component({
  selector: 'app-stub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleCasePipe],
  template: `
    <div class="adm-card adm-empty">
      <h2 class="acva-heading-6 fw-600">{{ section() | titlecase }}</h2>
      <p>This management area is coming in a later round.</p>
    </div>
  `,
})
export class Stub {
  private readonly route = inject(ActivatedRoute);
  readonly section = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('stub') ?? 'section')),
    { initialValue: 'section' },
  );
}
