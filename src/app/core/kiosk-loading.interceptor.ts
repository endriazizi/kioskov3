import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { KioskLoadingService } from '../providers/kiosk-loading.service';
import { KIOSK_HTTP_SILENT } from './kiosk-http-context';

/** Overlay spinner solo su POST/PUT/PATCH (GET home/poll non devono coprire il totem). */
function isBackgroundKioskRequest(url: string, silent: boolean, method: string): boolean {
  if (silent) return true;
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') return true;
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
  if (isBackgroundKioskRequest(req.url, req.context.get(KIOSK_HTTP_SILENT), req.method)) {
    return next(req);
  }
  const kioskLoading = inject(KioskLoadingService);
  kioskLoading.begin();
  return next(req).pipe(finalize(() => kioskLoading.end()));
};
