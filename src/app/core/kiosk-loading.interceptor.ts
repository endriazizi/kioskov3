import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { KioskLoadingService } from '../providers/kiosk-loading.service';
import { KIOSK_HTTP_SILENT } from './kiosk-http-context';

/** Overlay spinner solo su chiamate “foreground” (primo load, POST). */
function isBackgroundKioskRequest(url: string, silent: boolean): boolean {
  if (silent) return true;
  const path = url.split('?')[0].toLowerCase();
  return (
    path.includes('/api/public-kiosk/feed-version') ||
    path.includes('/api/public-kiosk/home')
  );
}

export const kioskLoadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/public-kiosk')) {
    return next(req);
  }
  if (isBackgroundKioskRequest(req.url, req.context.get(KIOSK_HTTP_SILENT))) {
    return next(req);
  }
  const kioskLoading = inject(KioskLoadingService);
  kioskLoading.begin();
  return next(req).pipe(finalize(() => kioskLoading.end()));
};
