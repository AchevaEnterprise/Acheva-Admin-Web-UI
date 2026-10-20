import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import {
  IPlatformSettings,
  IUpdatePlatformSettings,
} from '../models/admin.model';

/**
 * Acheva's commercial settings. Admin-only on the server — a Head who could
 * reach these could redirect their own department's share.
 */
@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.BASE_URL}/platform-settings`;

  current(): Observable<IAPIResponse<IPlatformSettings>> {
    return this.http.get<IAPIResponse<IPlatformSettings>>(this.base);
  }

  update(
    changes: IUpdatePlatformSettings,
  ): Observable<IAPIResponse<IPlatformSettings>> {
    return this.http.patch<IAPIResponse<IPlatformSettings>>(this.base, changes);
  }
}
