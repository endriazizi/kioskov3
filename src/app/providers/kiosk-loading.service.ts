import { Injectable, signal } from '@angular/core';

/**
 * Contatore richieste HTTP verso `/api/public-kiosk/*` per un unico overlay di caricamento.
 */
@Injectable({ providedIn: 'root' })
export class KioskLoadingService {
  private count = 0;
  readonly loading = signal(false);

  begin(): void {
    this.count++;
    this.loading.set(true);
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H1',location:'kiosk-loading.service.ts:begin',message:'Loading begin called',data:{count:this.count,loading:this.loading()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  end(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) this.loading.set(false);
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H1',location:'kiosk-loading.service.ts:end',message:'Loading end called',data:{count:this.count,loading:this.loading()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
}
