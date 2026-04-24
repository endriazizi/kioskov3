import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { KioskLoadingService } from '../providers/kiosk-loading.service';

/** Mostra lo spinner globale per ogni chiamata verso le API pubbliche kiosk. */
export const kioskLoadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/public-kiosk')) {
    return next(req);
  }
  const kioskLoading = inject(KioskLoadingService);
  kioskLoading.begin();
  return next(req).pipe(finalize(() => kioskLoading.end()));
};
