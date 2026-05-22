import '@angular/compiler';

import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { kioskLoadingInterceptor } from './app/core/kiosk-loading.interceptor';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  PreloadAllModules,
  provideRouter,
  RouteReuseStrategy,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import {
  provideServiceWorker,
  ServiceWorkerModule,
} from '@angular/service-worker';
import { IonicStorageModule } from '@ionic/storage-angular';
import { setAssetPath } from 'ionicons';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

try {
  const base = new URL('./', window.location.href).toString();
  setAssetPath(base);
} catch {
  // ionicons userà path di default
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding()
    ),
    provideHttpClient(withInterceptors([kioskLoadingInterceptor])),
    importProvidersFrom(
      IonicStorageModule.forRoot(),
      ServiceWorkerModule.register('ngsw-worker.js', {
        enabled: environment.production,
      })
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch(err => console.error(err));
