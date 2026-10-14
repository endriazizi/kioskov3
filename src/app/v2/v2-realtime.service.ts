import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../environments/environment';
import { kioskDevLog } from '../utils/kiosk-dev-console';
import { V2CatalogStore } from './v2-catalog.store';

interface CatalogSignal {
  seq?: number;
  boot?: string;
}

/**
 * Avvisi realtime dal backend (`kiosk:catalog-changed` nella room `kiosk:public`).
 * Il messaggio non porta dati: il totem rilegge le API pubbliche già filtrate.
 * Se il socket è giù restano il polling di feed-version e il refresh periodico dello store.
 */
@Injectable({ providedIn: 'root' })
export class V2RealtimeService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly store = inject(V2CatalogStore);

  /** true quando il totem riceve gli avvisi in diretta. */
  readonly live = signal(false);

  private socket?: Socket;
  private lastSeq = -1;
  private lastBoot = '';

  start(): void {
    if (this.socket || !environment.useKioskPublicApi) return;
    const base = String(environment.apiBaseUrl || '').replace(/\/$/, '') || window.location.origin;
    this.zone.runOutsideAngular(() => {
      const s = io(base, {
        path: '/socket.io',
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30_000,
        timeout: 10_000,
      });
      this.socket = s;
      s.on('connect', () => {
        s.emit('kiosk:join');
        this.setLive(true);
      });
      s.on('disconnect', () => this.setLive(false));
      s.on('connect_error', () => this.setLive(false));
      // Alla (ri)connessione: se il contatore non è quello visto, qualcosa è cambiato mentre eravamo scollegati.
      s.on('kiosk:catalog-state', (st: CatalogSignal) => {
        if (this.isNew(st)) this.refresh('socket-resync');
      });
      s.on('kiosk:catalog-changed', (st: CatalogSignal) => {
        if (this.isNew(st)) this.refresh('socket');
      });
    });
  }

  stop(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.setLive(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private isNew(st: CatalogSignal): boolean {
    const seq = Number(st?.seq ?? -1);
    const boot = String(st?.boot ?? '');
    const first = this.lastSeq < 0;
    const changed = boot !== this.lastBoot || seq !== this.lastSeq;
    this.lastSeq = seq;
    this.lastBoot = boot;
    // Primo stato dopo l'avvio: lo store ha già caricato, basta memorizzarlo.
    return changed && !first;
  }

  private refresh(reason: string): void {
    kioskDevLog('📡 [v2] avviso catalogo dal backend', reason);
    void this.store.refresh(reason);
  }

  private setLive(v: boolean): void {
    if (this.live() !== v) this.zone.run(() => this.live.set(v));
  }
}
