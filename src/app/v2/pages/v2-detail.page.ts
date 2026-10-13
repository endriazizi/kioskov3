import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';

import type { Speaker } from '../../interfaces/conference.interfaces';
import { ConferenceService } from '../../providers/conference.service';
import { KioskApiService } from '../../providers/kiosk-api.service';
import { sanitizeKioskProseHtml } from '../../security/kiosk-outbound-guard';
import { V2CatalogStore } from '../v2-catalog.store';
import { V2IconComponent } from '../v2-icon.component';
import { safeBusinessSlug } from '../v2-poster.util';

/** Stessa regola della scheda attuale: sito (https) → telefono (tel:) → email (mailto:). */
function qrPayload(sp: Speaker): string {
  const raw = String(sp.sito || '').trim();
  if (raw && !/^(feed|none|n\/a)$/i.test(raw)) {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw.replace(/^\/+/, '')}`;
  }
  const phone = String(sp.phone || '').trim().replace(/\s/g, '');
  if (phone.length >= 6) return `tel:${phone}`;
  const em = String(sp.email || '').trim();
  return em.includes('@') ? `mailto:${em}` : '';
}

@Component({
  selector: 'app-v2-detail',
  standalone: true,
  imports: [V2IconComponent, RouterLink],
  template: `
    <section class="v2-page v2-detail">
      <a class="v2-back" routerLink="/v2/attivita"><app-v2-icon name="back" />Tutte le attività</a>
      @if (gone()) {
        <div class="v2-gone" role="status">
          <h1>Scheda non più disponibile</h1>
          <p>Questa attività non è più pubblicata sul totem.</p>
          <a class="v2-btn" routerLink="/v2/attivita">Torna all'elenco</a>
        </div>
      } @else if (biz(); as b) {
        <div class="v2-hero">
          @if (b.coverUrl) {
            <img [src]="b.coverUrl" alt="" (error)="$any($event.target).hidden = true" />
          }
          <div class="v2-hero-cap">
            <span class="v2-card-cat">{{ b.category }}</span>
            <h1>{{ b.name }}</h1>
          </div>
        </div>
        <div class="v2-detail-cols">
          <div>
            @if (aboutHtml()) {
              <div class="v2-prose" [innerHTML]="aboutHtml()"></div>
            } @else if (b.description) {
              <p class="v2-prose">{{ b.description }}</p>
            }
            @if (gallery().length) {
              <div class="v2-gallery">
                @for (g of gallery(); track g) {
                  <img [src]="g" alt="" loading="lazy" (error)="$any($event.target).hidden = true" />
                }
              </div>
            }
          </div>
          <aside class="v2-facts">
            @if (b.address) { <p><app-v2-icon name="pin" />{{ b.address }}</p> }
            @if (b.openingHours) { <p><app-v2-icon name="clock" />{{ b.openingHours }}</p> }
            @if (b.phone) { <p><app-v2-icon name="phone" />{{ b.phone }}</p> }
            @if (qr()) {
              <figure class="v2-qr">
                <img [src]="qr()" alt="Codice QR per contattare l'attività" />
                <figcaption>Inquadra con il telefono</figcaption>
              </figure>
            }
          </aside>
        </div>
      } @else {
        <p class="v2-empty">Caricamento…</p>
      }
    </section>
  `,
})
export class V2DetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(KioskApiService);
  private readonly conference = inject(ConferenceService);
  private readonly store = inject(V2CatalogStore);

  readonly slug = signal('');
  readonly biz = signal<Speaker | null>(null);
  readonly gone = signal(false);
  readonly qr = signal('');
  readonly aboutHtml = computed(() => sanitizeKioskProseHtml(this.biz()?.about));
  readonly gallery = computed(() => (this.biz()?.gallery ?? []).filter(Boolean).slice(0, 8));

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((p) => {
      void this.load(p.get('slug') ?? '');
    });
    // Attività ritirata mentre la scheda è aperta: si chiude senza ricaricare la pagina.
    effect(() => {
      const r = this.store.lastRemoved();
      const s = this.slug();
      if (r && s && r.slugs.includes(s)) this.gone.set(true);
    });
  }

  private async load(raw: string): Promise<void> {
    const slug = safeBusinessSlug(raw) ?? '';
    this.slug.set(slug);
    this.gone.set(false);
    this.qr.set('');
    if (!slug) {
      this.gone.set(true);
      return;
    }
    // Mostra subito i dati dal catalogo, poi il dettaglio completo dall'API.
    const cached = this.store.findBySlug(slug) ?? null;
    this.biz.set(cached);
    if (cached) void this.makeQr(cached);
    try {
      const dto = this.api.unwrapBusinessSingle(await firstValueFrom(this.api.getBusinessBySlug(slug)));
      const ok = dto && this.api.filterPublishedForKiosk([dto]).length > 0;
      if (this.slug() !== slug) return;
      if (!ok) {
        this.gone.set(true);
        return;
      }
      const sp = this.conference.mapKioskBusinessToSpeaker(dto);
      this.biz.set(sp);
      void this.makeQr(sp);
    } catch (e) {
      if (this.slug() !== slug) return;
      if (e instanceof HttpErrorResponse && e.status === 404) this.gone.set(true);
      else if (!cached) this.gone.set(true);
    }
  }

  private async makeQr(sp: Speaker): Promise<void> {
    const data = qrPayload(sp);
    if (!data) return;
    try {
      this.qr.set(await QRCode.toDataURL(data, { margin: 1, width: 240, errorCorrectionLevel: 'M' }));
    } catch {
      this.qr.set('');
    }
  }
}
