import { NgStyle } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  callOutline,
  closeOutline,
  locationOutline,
  logoInstagram,
  logoTwitter,
  mailOutline,
  timeOutline,
} from 'ionicons/icons';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import QRCode from 'qrcode';

import { Speaker } from '../../interfaces/conference.interfaces';
import { ConferenceService } from '../../providers/conference.service';
import { KioskApiService } from '../../providers/kiosk-api.service';
import { kioskDevLog } from '../../utils/kiosk-dev-console';
import { KioskWhitelistService } from '../../security/kiosk-whitelist.service';

import { GelateriaCentraleComponent } from '../gelateria-centrale/gelateria-centrale.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'page-speaker-detail',
  templateUrl: 'speaker-detail.html',
  styleUrls: ['./speaker-detail.scss'],
  standalone: true,
  imports: [
    IonItem,
    IonList,
    IonContent,
    IonModal,
    IonHeader,
    IonToolbar,
    IonButton,
    IonButtons,
    IonBackButton,
    IonIcon,
    IonChip,
    IonLabel,
    NgStyle,
    GelateriaCentraleComponent,
  ],
})
export class SpeakerDetailPage {
  speaker!: Speaker;
  detailQrDataUrl = '';
  galleryFullscreenOpen = false;
  galleryFullscreenSrc = '';
  private galleryCurrentIndex = 0;
  private galleryAutoTimer?: ReturnType<typeof setInterval>;
  @ViewChild('galleryStrip') private galleryStripRef?: ElementRef<HTMLElement>;

  private confService = inject(ConferenceService);
  private kioskApi = inject(KioskApiService);
  private whitelist = inject(KioskWhitelistService);
  private route = inject(ActivatedRoute);

  constructor() {
    addIcons({
      logoTwitter,
      logoInstagram,
      locationOutline,
      callOutline,
      mailOutline,
      timeOutline,
      closeOutline,
    });
  }

  ionViewWillEnter(): void {
    const speakerId = this.route.snapshot.paramMap.get('speakerId');
    if (!speakerId) return;
    /** L’API accetta solo slug URL (es. `la-lanterna`), non l’id numerico del mock JSON. */
    const apiSlug =
      environment.legacySpeakerIdToSlug?.[speakerId] ?? speakerId;

    this.kioskApi
      .getBusinessBySlug(apiSlug)
      .pipe(
        map((raw) => this.kioskApi.unwrapBusinessSingle(raw)),
        map((dto) =>
          dto ? this.confService.mapKioskBusinessToSpeaker(dto) : null
        ),
        catchError((err) => {
          console.warn(
            '⚠️ [SpeakerDetail] GET /api/public-kiosk/businesses/:slug KO — fallback lista ConferenceService',
            err
          );
          return of(null);
        }),
        switchMap((apiSpeaker) => {
          if (apiSpeaker) {
            kioskDevLog('✅ [SpeakerDetail] Dettaglio attività da API pubblica');
            return of(apiSpeaker);
          }
          return this.confService.load().pipe(
            map(
              (data) =>
                data.speakers.find((s) => s?.id === speakerId || s?.slug === speakerId) ?? null
            )
          );
        })
      )
      .subscribe((sp) => {
        if (sp) {
          this.speaker = sp;
          void this.refreshDetailQr();
          this.galleryCurrentIndex = 0;
          this.startGalleryAutoScroll();
        }
      });
  }

  ionViewDidLeave(): void {
    this.stopGalleryAutoScroll();
  }

  ngOnDestroy(): void {
    this.stopGalleryAutoScroll();
  }

  /** Sfondo hero chiaro: immagine leggermente velata su bianco (no fascia nera) */
  coverBgStyle(): Record<string, string> {
    const u =
      this.speaker?.coverUrl ||
      'assets/img/speaker-background.png';
    return {
      backgroundColor: '#ffffff',
      backgroundImage: `linear-gradient(rgba(255,255,255,0.94), rgba(255,255,255,0.9)), url('${u}')`,
    };
  }

  /** Immagini galleria: campo `gallery` o array legacy `foto` */
  galleryImages(): string[] {
    if (!this.speaker) return [];
    if (this.speaker.gallery?.length) return this.speaker.gallery;
    const f = this.speaker.foto;
    if (Array.isArray(f)) return f as string[];
    return [];
  }

  private startGalleryAutoScroll(): void {
    this.stopGalleryAutoScroll();
    const imgs = this.galleryImages();
    if (imgs.length <= 1) return;
    this.galleryAutoTimer = setInterval(() => {
      if (this.galleryFullscreenOpen) return;
      const next = (this.galleryCurrentIndex + 1) % imgs.length;
      this.scrollToGalleryIndex(next);
    }, 3500);
  }

  private stopGalleryAutoScroll(): void {
    if (this.galleryAutoTimer) {
      clearInterval(this.galleryAutoTimer);
      this.galleryAutoTimer = undefined;
    }
  }

  private scrollToGalleryIndex(index: number): void {
    const strip = this.galleryStripRef?.nativeElement;
    if (!strip) return;
    const items = strip.querySelectorAll<HTMLElement>('.activity-gallery-item');
    if (!items.length) return;
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    items[safeIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    this.galleryCurrentIndex = safeIndex;
  }

  openGalleryFullscreen(img: string): void {
    if (!img) return;
    this.galleryFullscreenSrc = img;
    this.galleryFullscreenOpen = true;
    this.stopGalleryAutoScroll();
  }

  closeGalleryFullscreen(): void {
    this.galleryFullscreenOpen = false;
    this.galleryFullscreenSrc = '';
    this.startGalleryAutoScroll();
  }

  /**
   * Sito con schema oppure dominio tipo `esempio.it` → `https://esempio.it`
   */
  private normalizeWebsiteUrl(raw: string): string | null {
    const s = String(raw || '').trim();
    if (!s || /^(feed|none|n\/a)$/i.test(s)) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i.test(s)) {
      return `https://${s.replace(/^\/+/, '')}`;
    }
    return null;
  }

  /**
   * Payload codificato nel QR: priorità sito (https) → telefono (tel:) → email (mailto:).
   * Così ogni scheda con almeno uno tra sito validabile, telefono o email mostra un QR.
   */
  private qrPayloadData(): string {
    const sp = this.speaker;
    if (!sp) return '';
    const web = this.normalizeWebsiteUrl(sp.sito || '');
    if (web) return web;
    const phone = (sp.phone || '').trim().replace(/\s/g, '');
    if (phone.length >= 6) return phone.startsWith('+') ? `tel:${phone}` : `tel:${phone}`;
    const em = (sp.email || '').trim();
    if (em.includes('@')) return `mailto:${em}`;
    return '';
  }

  /** URL immagine QR in DataURL locale (senza dipendenze esterne). */
  detailQrImageSrc(): string {
    return this.detailQrDataUrl;
  }

  showDetailQrBlock(): boolean {
    return !!this.detailQrImageSrc();
  }

  /** Rigenera QR locale quando cambia attività o payload (best-effort). */
  private async refreshDetailQr(): Promise<void> {
    const data = this.qrPayloadData();
    if (!data) {
      this.detailQrDataUrl = '';
      return;
    }
    try {
      this.detailQrDataUrl = await QRCode.toDataURL(data, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.warn('⚠️ [SpeakerDetail] QR locale KO', e);
      this.detailQrDataUrl = '';
    }
  }

  /** Testo sotto al titolo in base al tipo di link codificato */
  detailQrHint(): string {
    const sp = this.speaker;
    if (!sp) return '';
    if (this.normalizeWebsiteUrl(sp.sito || '')) {
      return 'Scansiona il QR per aprire il sito web dell’attività (non disponibile sul totem).';
    }
    if ((sp.phone || '').trim().length >= 6) {
      return 'Scansiona il QR per avviare una chiamata dal tuo smartphone.';
    }
    if ((sp.email || '').includes('@')) {
      return 'Scansiona il QR per aprire l’email sul tuo smartphone.';
    }
    return '';
  }

  /** tel: / mailto: solo se policy kiosk lo consente */
  openTelSafe(): void {
    const phone = (this.speaker?.phone || '').trim();
    if (!phone) return;
    const href = `tel:${phone.replace(/\s/g, '')}`;
    if (!this.whitelist.isAllowed(href)) {
      this.whitelist.logBlockedExternal(href, 'SpeakerDetail tel');
      return;
    }
    // assign è intercettato da appKioskWhitelist; location.href bypassa il patch
    window.location.assign(href);
  }

  openMailtoSafe(): void {
    const email = (this.speaker?.email || '').trim();
    if (!email) return;
    const href = `mailto:${email}`;
    if (!this.whitelist.isAllowed(href)) {
      this.whitelist.logBlockedExternal(href, 'SpeakerDetail mailto');
      return;
    }
    window.location.assign(href);
  }

  onImageLoad(slot: 'avatar' | 'brandLogo', src: string | null | undefined): void {
    void slot;
    void src;
  }

  onImageError(slot: 'avatar' | 'brandLogo', src: string | null | undefined): void {
    if (!this.speaker) return;
    const fallback = 'assets/img/kiosk-poster-placeholder.svg';
    if (slot === 'avatar' && this.speaker.profilePic !== fallback) {
      this.speaker = { ...this.speaker, profilePic: fallback };
    }
    if (slot === 'brandLogo' && this.speaker.logo !== fallback) {
      this.speaker = { ...this.speaker, logo: fallback };
    }
    void src;
  }
}
