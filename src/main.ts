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
  // #region agent log
  fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f3cc8'},body:JSON.stringify({sessionId:'6f3cc8',runId:'post-fix',hypothesisId:'H17',location:'main.ts:setAssetPath',message:'ionicons asset path configured',data:{base},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
} catch (e) {
  // #region agent log
  fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f3cc8'},body:JSON.stringify({sessionId:'6f3cc8',runId:'post-fix',hypothesisId:'H17',location:'main.ts:setAssetPath',message:'ionicons asset path setup failed',data:{error:String((e && e.message) || e || '')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
