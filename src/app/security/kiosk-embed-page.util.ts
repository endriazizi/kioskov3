import { isPlatform } from '@ionic/angular';

import { environment } from '../../environments/environment';

/** Totem strict / PWA: contenuto partner in iframe sandbox, mai browser di sistema. */
export function kioskEmbedUseInAppFrame(): boolean {
  if (environment.kioskStrictMode) return true;
  const w = window as Window & { cordova?: unknown };
  return !w.cordova;
}

export function kioskEmbedIsHybridShell(): boolean {
  return (
    isPlatform('hybrid') ||
    isPlatform('capacitor') ||
    isPlatform('cordova')
  );
}
