import { HttpContextToken } from '@angular/common/http';

/**
 * GET di background (polling feed-version, refresh poster) non devono
 * accendere l’overlay spinner a tutto schermo — su totem è flickering.
 */
export const KIOSK_HTTP_SILENT = new HttpContextToken<boolean>(() => false);
