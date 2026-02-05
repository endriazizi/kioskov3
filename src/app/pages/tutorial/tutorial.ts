import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
  inject,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonModal,
  MenuController,
  ToastController,
  IonCard,
  IonCardContent,
} from "@ionic/angular/standalone";
import { IonContent as IonContentBase } from "@ionic/angular";
import { Storage } from "@ionic/storage-angular";
import { addIcons } from "ionicons";
import { arrowForward, close, menuOutline } from "ionicons/icons";
import { HttpClient } from "@angular/common/http";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { bindKioskUiTopAuto } from "../../shared/kiosk-ui-top";

/** Item del carosello (internalRoute = pagina in-app come Vivere Camerino; externalUrl = modal webview) */
type AdItem = { kind: "image" | "video"; src: string; poster?: string; externalUrl?: string; internalRoute?: string };

@Component({
  standalone: true,
  selector: "page-tutorial",
  templateUrl: "tutorial.html",
  styleUrls: ["./tutorial.scss"],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonModal,
    IonCard,
    IonCardContent,
  ],
})
export class TutorialPage implements OnInit, AfterViewInit, OnDestroy {
  // Services
  private menu = inject(MenuController);
  private router = inject(Router);
  private storage = inject(Storage);
  private http = inject(HttpClient);
  private toastCtrl = inject(ToastController);
  private sanitizer = inject(DomSanitizer);

  // Header / UI
  showSkip = true;

  // Clock / Weather
  currentTime!: string;
  currentDate = "";
  weather: any;
  private weatherApiKey = "41266f28a33c8ef363049edf9b38275e";
  private weatherCity = "Castelraimondo";
  private clockInterval?: any;

  // View refs
  @ViewChild("pageContent", { static: true }) pageContent!: IonContentBase;
  @ViewChild("firstSlide", { static: true })
  firstSlide!: ElementRef<HTMLElement>;

  // Slide 1: Carosello
  @ViewChild("adsTrack", { static: false })
  adsTrack!: ElementRef<HTMLDivElement>;
  @ViewChildren("adVideo") adVideoEls!: QueryList<ElementRef<HTMLVideoElement>>;

  ads: AdItem[] = [
    // { kind: "image", src: "assets/poster/a3_01.png" },
    
    { kind: "image", src: "assets/poster/a3_02.jpg" },
    { kind: "image", src: "assets/poster/a3_03.jpg" },
    { kind: "image", src: "assets/poster/lanterna.jpg", internalRoute: "/app/tabs/prenota-lanterna" },
    { kind: "image", src: "assets/poster/a3_05.jpg" },
    { kind: "image", src: "assets/poster/a3_06.jpg" },
   
    { kind: "video", src: "assets/poster/eclissi.mp4" }, // video carosello centrale_video.mp4
    { kind: "video", src: "assets/poster/bar centrale_TikTok.mp4" },
  ];
  adsIndex = 0;

  private readonly ADS_DURATION_MS = 10_000;
  private adsTimer?: any;
  private adsUserPause = false;
  private adsScrollDebounce?: any;

  // Video carosello: auto-duration + audio
  private adDurationsMs: number[] = [];
  private readonly VIDEO_FALLBACK_MS = 15_000;
  private videoAdAdvanceTimer?: any;
  adsMuted = true;
  adsShowUnmuteBtn = false;

  // Modal immagine
  isImageModalOpen = false;
  modalImageSrc = "";
  private modalAutoCloseTimer?: any;

  // Modal sito esterno (es. lanterna – in-app webview)
  isWebViewOpen = false;
  webViewUrl = "";
  /** URL sanitizzato (cached): evita getter che crea nuovo oggetto ogni CD → iframe reload loop → Chrome throttling */
  webViewSafeUrl: SafeResourceUrl | null = null;

  // Slide 3: Video principale
  @ViewChild("slideVideo", { static: true })
  slideVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild("videoSection", { static: true })
  videoSection!: ElementRef<HTMLElement>;
  private readonly VIDEO_SRC = "assets/video/polveredistelle.mp4";
  muted = true;
  showUnmuteBtn = false;
  isPlaying = false;
  isVideoActive = false;
  private videoSrcSet = false;
  private io?: IntersectionObserver;

  // ===== INIZIO MODIFICA: fix audio “fuori turno” + mapping corretto video =====
  /**
   * Nel template i video sono pochi, ma `adsIndex` conta anche le immagini.
   * Quindi NON si può fare `adVideoEls[adsIndex]`.
   * Questo array contiene gli indici dentro `ads` che sono video, es:
   * ads = [img(0), video(1), img(2), ..., video(10), video(11)]
   * videoAdIndexes = [1, 10, 11]
   */
  private videoAdIndexes: number[] = [];

  /** True dopo il primo gesto utente (sblocco policy browser per audio) */
  private adsAudioUnlocked = false;

  /** True solo se l’utente ha richiesto audio (tap sul bottone) */
  private adsAudioWanted = false;
  // ===== FINE MODIFICA =====

  // Primo gesto: ora sblocca anche il video del carosello
  private firstGestureHandlerAll = () => {
    // ===== INIZIO MODIFICA =====
    // ✅ memorizzo che l’utente ha fatto un gesto: ora l’audio può essere “consentito”
    // ma lo abilitiamo SOLO quando l’utente lo chiede (adsAudioWanted).
    this.adsAudioUnlocked = true;

    // Se siamo su un video, mostra il bottone audio (così l’utente decide)
    this.adsShowUnmuteBtn = this.isCurrentAdVideo;
    // ===== FINE MODIFICA =====

    this.ensureAdVideoPlaying(this.adsIndex);
    this.forceUnlockAudio(); // per la slide video principale se attiva
  };

  // Toast assistenza
  private ioFirst?: IntersectionObserver;
  isFirstSlideActive = false;
  supportModalOpen = false;
  supportWhatsappLink = "";
  supportQrSrc = "";
  private supportDelayTimer?: any;
  private supportToastShown = false;
  private readonly SUPPORT_TOAST_DELAY_MS = 6_000;
  private readonly SUPPORT_TOAST_DURATION_MS = 12_000;

  // Top dinamico (header + box meteo)
  private unbindKiosk?: () => void;

  // Observer per i video del carosello
  private adVideoIO?: IntersectionObserver;

  constructor() {
    addIcons({ arrowForward, close, menuOutline });

    // ===== INIZIO MODIFICA =====
    // Cache dei video presenti in `ads` (serve per mappare video DOM ↔ adsIndex)
    this.rebuildVideoAdIndexes();
    // ===== FINE MODIFICA =====
  }

  // Lifecycle
  ngOnInit() {
    this.updateTimeAndDate();
    this.clockInterval = setInterval(() => this.updateTimeAndDate(), 1000);
    this.fetchWeather();
  }

  async ngAfterViewInit() {
    try {
      await this.pageContent.getScrollElement();
    } catch {}

    // Carosello
    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
    this.startAdsCarousel();

    // Slide video principale
    this.setupIntersectionObserverForVideo();
    this.setupFirstSlideObserver();

    // Observer sui video del carosello
    this.bindAdVideoObserver();
    this.adVideoEls.changes.subscribe(() => this.bindAdVideoObserver());

    // Sblocco su qualsiasi gesto (tap/tasto) — utile su alcuni Android/iOS
    window.addEventListener("pointerdown", this.firstGestureHandlerAll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", this.firstGestureHandlerAll, {
      capture: true,
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (this.isCurrentAdVideo) this.ensureAdVideoPlaying(this.adsIndex);
        if (this.isVideoActive) this.startVideo();
      }
    });

    // Misura top dinamico (header + box meteo) → scrive --kiosk-ui-top
    this.unbindKiosk = bindKioskUiTopAuto({
      headerSelector: "ion-header",
      weatherBoxSelector: ".info-kiosk",
      cssVarName: "--kiosk-ui-top",
      log: false,
    });
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.stopAdsCarousel();
    this.clearVideoAdAdvance();

    if (this.io) this.io.disconnect();
    if (this.ioFirst) this.ioFirst.disconnect();
    if (this.adVideoIO) this.adVideoIO.disconnect();

    window.removeEventListener(
      "pointerdown",
      this.firstGestureHandlerAll,
      true
    );
    window.removeEventListener("keydown", this.firstGestureHandlerAll, true);

    this.pauseVideo(true);
    this.menu.enable(true);
    this.clearSupportTimers();
    this.supportToastShown = false;
    this.unbindKiosk?.();
  }

  // ========= CLOCK / METEO =========
  updateTimeAndDate() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    this.currentDate = now.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  fetchWeather() {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.weatherCity}&appid=${this.weatherApiKey}&units=metric&lang=it`;
    this.http.get(url).subscribe({
      next: (data) => (this.weather = data),
      error: (err) => console.error("Errore meteo:", err),
    });
  }

  // ========= CAROSELLO POSTER / VIDEO =========
  startAdsCarousel() {
    if (!this.ads.length || this.adsTimer) return;
    this.adsTimer = setInterval(() => {
      if (this.adsUserPause) return;
      const current = this.ads[this.adsIndex];
      if (current?.kind === "video") return;
      const next = (this.adsIndex + 1) % this.ads.length;
      this.goToAd(next);
    }, this.ADS_DURATION_MS);
  }

  stopAdsCarousel() {
    if (this.adsTimer) {
      clearInterval(this.adsTimer);
      this.adsTimer = undefined;
    }
  }

  // ===== INIZIO MODIFICA =====
  /** Ricostruisce l’elenco degli indici video presenti nell’array `ads` */
  private rebuildVideoAdIndexes() {
    this.videoAdIndexes = [];
    for (let i = 0; i < this.ads.length; i++) {
      if (this.ads[i]?.kind === "video") this.videoAdIndexes.push(i);
    }
  }

  /**
   * Ritorna l’elemento <video> DOM associato ad un certo indice `adsIndex`.
   * ✅ Mapping corretto: adIndex -> ordinal video -> QueryList video.
   */
  private getVideoElByAdIndex(adIndex: number): HTMLVideoElement | null {
    const ordinal = this.videoAdIndexes.indexOf(adIndex);
    if (ordinal < 0) return null;
    const v = this.adVideoEls?.toArray()?.[ordinal]?.nativeElement;
    return v ?? null;
  }

  /** Stop + mute sicuro (così non “scappa” audio) */
  private stopAndMuteVideoEl(v: HTMLVideoElement, resetTime = false) {
    try {
      v.pause();
      v.muted = true;
      v.setAttribute("muted", "");
      if (resetTime) v.currentTime = 0;
    } catch {}
  }

  /** Muta/stoppa TUTTI i video tranne quello di turno (se è un video) */
  private syncAdVideos() {
    const videos = this.adVideoEls?.toArray() ?? [];
    if (!videos.length) return;

    const currentAdIndex = this.adsIndex;
    const currentIsVideo = this.isCurrentAdVideo;

    // 1) stop+muto di sicurezza per tutti
    videos.forEach((ref) => this.stopAndMuteVideoEl(ref.nativeElement, false));

    // 2) se il current è video → lo faccio partire (muted). L’audio solo se richiesto.
    if (currentIsVideo) this.ensureAdVideoPlaying(currentAdIndex);
  }
  // ===== FINE MODIFICA =====

  private pauseAllAdVideos(resetTime = true) {
    this.adVideoEls?.forEach((ref) => {
      const v = ref.nativeElement;
      // ===== INIZIO MODIFICA =====
      // prima pausavi soltanto: ora mettiamo anche muted per evitare audio fantasma
      this.stopAndMuteVideoEl(v, resetTime);
      // ===== FINE MODIFICA =====
    });
  }

  /** Observer: fa partire i video quando sono realmente in vista */
  private bindAdVideoObserver() {
    try {
      this.adVideoIO?.disconnect();
    } catch {}
    if (!this.adVideoEls || !this.adVideoEls.length) return;

    // ===== INIZIO MODIFICA =====
    // root = contenitore scroll orizzontale del carosello
    // così l’IntersectionObserver ragiona “dentro” il track, non sulla viewport intera
    const rootEl = this.adsTrack?.nativeElement ?? null;
    // ===== FINE MODIFICA =====

    this.adVideoIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;

          // ===== INIZIO MODIFICA =====
          // Ordinale del video nel DOM (0..nVideo-1)
          const ordinal = this.adVideoEls
            .toArray()
            .findIndex((r) => r.nativeElement === v);
          if (ordinal < 0) return;

          // Indice corrispondente in `ads`
          const adIndex = this.videoAdIndexes[ordinal];
          if (typeof adIndex !== "number") return;

          // Se NON è il video di turno → stop + mute SEMPRE (così niente audio fuori turno)
          if (adIndex !== this.adsIndex) {
            this.stopAndMuteVideoEl(v, false);
            return;
          }

          // È quello di turno: parte solo se davvero visibile nel track
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            this.ensureAdVideoPlaying(adIndex);
          }
          // ===== FINE MODIFICA =====
        });
      },
      {
        threshold: [0, 0.6, 1],
        // ===== INIZIO MODIFICA =====
        root: rootEl,
        // ===== FINE MODIFICA =====
      }
    );

    this.adVideoEls.forEach((r) => this.adVideoIO!.observe(r.nativeElement));
  }

  /** Avvio robusto del video “di turno” con retry progressivi */
  private ensureAdVideoPlaying(adIndex: number) {
    // ===== INIZIO MODIFICA =====
    // ✅ Qui NON usiamo più adIndex come indice dei video.
    // Prendiamo il video corretto tramite mapping.
    const v = this.getVideoElByAdIndex(adIndex);
    if (!v) return;

    // Se qualcuno chiama per errore un video non di turno → lo blocco subito
    if (adIndex !== this.adsIndex) {
      this.stopAndMuteVideoEl(v, false);
      return;
    }
    // ===== FINE MODIFICA =====

    // proprietà + attributi richiesti su iOS
    v.muted = true;
    v.setAttribute("muted", ""); // importante su Safari
    (v as any).playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "true");
    v.autoplay = true;

    // ===== INIZIO MODIFICA =====
    // di default: audio OFF.
    // Mostro CTA solo se:
    // - è un video corrente
    // - l’utente ha già fatto almeno un gesto (così il bottone ha senso)
    this.adsMuted = true;
    this.adsShowUnmuteBtn = this.adsAudioUnlocked && this.isCurrentAdVideo;
    // ===== FINE MODIFICA =====

    const tryPlay = (tries = 6) => {
      try {
        // NB: load() forza refresh; lo lasciamo per la tua logica “robusta”
        v.load();
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            // ===== INIZIO MODIFICA =====
            // ✅ Unmute SOLO se:
            // - è il video corrente
            // - l’utente ha sbloccato policy (gesture)
            // - l’utente ha CHIESTO audio (tap sul bottone)
            if (
              adIndex === this.adsIndex &&
              this.adsAudioUnlocked &&
              this.adsAudioWanted
            ) {
              this.tryUnmuteAd(adIndex);
            } else {
              // rimane MUTED (evita audio fantasma)
              v.muted = true;
              v.setAttribute("muted", "");
            }
            // ===== FINE MODIFICA =====
          }).catch(() => {
            if (tries > 0) setTimeout(() => tryPlay(tries - 1), 300);
            else {
              this.adsMuted = true;
              this.adsShowUnmuteBtn =
                this.adsAudioUnlocked && this.isCurrentAdVideo;
            }
          });
        }
      } catch {
        if (tries > 0) setTimeout(() => tryPlay(tries - 1), 300);
        else {
          this.adsMuted = true;
          this.adsShowUnmuteBtn = this.adsAudioUnlocked && this.isCurrentAdVideo;
        }
      }
    };

    const once = (ev: keyof HTMLVideoElementEventMap, fn: any) => {
      const h = () => {
        v.removeEventListener(ev, h as any);
        fn();
      };
      v.addEventListener(ev, h as any, { once: true });
    };
    once("loadeddata", () => tryPlay(4));
    once("canplaythrough", () => tryPlay(4));

    tryPlay();
  }

  private enterVideoAd(adIndex: number) {
    this.stopAdsCarousel();
    this.clearVideoAdAdvance();
    this.ensureAdVideoPlaying(adIndex);

    // ===== INIZIO MODIFICA =====
    const v = this.getVideoElByAdIndex(adIndex);
    // ===== FINE MODIFICA =====
    if (!v) return;

    const durMs = Number.isFinite(this.adDurationsMs[adIndex])
      ? this.adDurationsMs[adIndex]
      : Number.isFinite(v.duration) && v.duration > 0
      ? v.duration * 1000
      : this.VIDEO_FALLBACK_MS;

    this.videoAdAdvanceTimer = setTimeout(() => {
      this.goToAd((adIndex + 1) % this.ads.length);
    }, Math.max(1000, durMs + 300));
  }

  private leaveVideoAd() {
    this.clearVideoAdAdvance();
  }

  private clearVideoAdAdvance() {
    if (this.videoAdAdvanceTimer) {
      clearTimeout(this.videoAdAdvanceTimer);
      this.videoAdAdvanceTimer = undefined;
    }
  }

  private async tryUnmuteAd(adIndex: number) {
    // ===== INIZIO MODIFICA =====
    // ✅ anti-audio-fantasma: mai unmute fuori turno
    if (adIndex !== this.adsIndex) return;
    if (!this.adsAudioUnlocked) return;
    if (!this.adsAudioWanted) return;

    const v = this.getVideoElByAdIndex(adIndex);
    // ===== FINE MODIFICA =====
    if (!v) return;

    try {
      v.muted = false;
      await v.play();
      this.adsMuted = false;
      this.adsShowUnmuteBtn = false;
    } catch {
      v.muted = true;
      v.setAttribute("muted", "");
      this.adsMuted = true;
      this.adsShowUnmuteBtn = this.adsAudioUnlocked && this.isCurrentAdVideo;
    }
  }

  goToAd(i: number, behavior: ScrollBehavior = "smooth") {
    const prev = this.ads[this.adsIndex];
    if (prev?.kind === "video") this.leaveVideoAd();

    // ===== INIZIO MODIFICA =====
    // quando cambio slide, l’audio NON deve “restare armato”
    this.adsAudioWanted = false;
    this.adsMuted = true;
    this.adsShowUnmuteBtn = false;
    // ===== FINE MODIFICA =====

    this.adsIndex = Math.max(0, Math.min(i, this.ads.length - 1));
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const x = this.adsIndex * track.clientWidth;
    track.scrollTo({ left: x, behavior });

    const current = this.ads[this.adsIndex];
    this.pauseAllAdVideos(false);
    if (current?.kind === "video") this.enterVideoAd(this.adsIndex);
    else this.startAdsCarousel();

    // ===== INIZIO MODIFICA =====
    // allineo stato video: solo quello di turno può riprodurre / avere audio
    this.syncAdVideos();

    // se siamo su un video e l’utente ha già “sbloccato” il device, mostro CTA
    this.adsShowUnmuteBtn = this.adsAudioUnlocked && this.isCurrentAdVideo;
    // ===== FINE MODIFICA =====
  }

  onAdsScroll() {
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const w = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== this.adsIndex) {
      const prev = this.ads[this.adsIndex];
      if (prev?.kind === "video") this.leaveVideoAd();

      // ===== INIZIO MODIFICA =====
      // anche con scroll manuale: resetto “armed audio”
      this.adsAudioWanted = false;
      this.adsMuted = true;
      this.adsShowUnmuteBtn = false;
      // ===== FINE MODIFICA =====

      this.adsIndex = idx;
      this.pauseAllAdVideos(false);

      const current = this.ads[this.adsIndex];
      if (current?.kind === "video") this.enterVideoAd(this.adsIndex);
      else this.startAdsCarousel();

      // ===== INIZIO MODIFICA =====
      this.syncAdVideos();
      this.adsShowUnmuteBtn = this.adsAudioUnlocked && this.isCurrentAdVideo;
      // ===== FINE MODIFICA =====
    }

    this.pauseAdsCarousel();
    clearTimeout(this.adsScrollDebounce);
    this.adsScrollDebounce = setTimeout(() => this.resumeAdsCarousel(), 2_500);
  }

  pauseAdsCarousel(user = false) {
    if (user) this.adsUserPause = true;
    this.stopAdsCarousel();
    this.clearVideoAdAdvance();
    this.pauseAllAdVideos(false);
  }

  resumeAdsCarousel() {
    this.adsUserPause = false;
    const current = this.ads[this.adsIndex];
    if (current?.kind === "video") this.enterVideoAd(this.adsIndex);
    else this.startAdsCarousel();
  }

  removeBrokenAd(i: number) {
    const missing = this.ads[i]?.src;
    console.warn("[Carosello] Media mancante: rimuovo", missing);

    // ===== INIZIO MODIFICA =====
    // se rimuovo un elemento, devo ricostruire la cache videoAdIndexes
    this.ads.splice(i, 1);
    this.rebuildVideoAdIndexes();
    // ===== FINE MODIFICA =====

    if (!this.ads.length) {
      this.stopAdsCarousel();
      this.clearVideoAdAdvance();
      return;
    }
    this.adsIndex = Math.min(this.adsIndex, this.ads.length - 1);
    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
  }

  // eventi video carosello
  onAdVideoMeta(i: number, ev: Event) {
    const v = ev?.target as HTMLVideoElement;
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      // i qui è l’indice ADS (come da template) -> perfetto
      this.adDurationsMs[i] = v.duration * 1000;
    }
  }

  onAdVideoEnded(i: number) {
    this.clearVideoAdAdvance();
    this.goToAd((i + 1) % this.ads.length);
  }

  // CTA audio carosello
  get isCurrentAdVideo(): boolean {
    return this.ads[this.adsIndex]?.kind === "video";
  }

  get showAdsAudioCta(): boolean {
    return this.isCurrentAdVideo && this.adsShowUnmuteBtn;
  }

  toggleAdsAudio() {
    // ===== INIZIO MODIFICA =====
    // l’utente CHIEDE audio → lo abilitiamo solo per il video corrente
    this.adsAudioWanted = true;
    this.tryUnmuteAd(this.adsIndex);
    // ===== FINE MODIFICA =====
  }

  // ========= MODAL IMMAGINE =========
  openImageFull(src: string): void {
    this.modalImageSrc = src;
    this.isImageModalOpen = true;
    if (this.modalAutoCloseTimer) clearTimeout(this.modalAutoCloseTimer);
    this.modalAutoCloseTimer = setTimeout(() => this.closeImageFull(), 10_000);
  }

  closeImageFull(): void {
    this.isImageModalOpen = false;
    if (this.modalAutoCloseTimer) {
      clearTimeout(this.modalAutoCloseTimer);
      this.modalAutoCloseTimer = undefined;
    }
  }

  /** Click su slide del carosello: pagina in-app (es. Prenota Lanterna), sito in modal, o immagine a tutto schermo */
  onAdClick(ad: AdItem, event: Event): void {
    if (ad.kind !== "image") return;
    event.preventDefault();
    event.stopPropagation();
    if (ad.internalRoute) {
      this.stopAdsCarousel();
      this.router.navigateByUrl(ad.internalRoute);
      return;
    }
    if (ad.externalUrl) {
      this.openExternalSite(ad.externalUrl);
    } else {
      this.openImageFull(ad.src);
    }
  }

  /** Apre il sito sempre in-app (webview modal): resta dentro Ionic, nessuna navigazione al browser esterno */
  openExternalSite(url: string): void {
    this.stopAdsCarousel();
    this.openWebViewModal(url);
    setTimeout(() => {
      if (this.webViewUrl && !this.isWebViewOpen) {
        this.isWebViewOpen = true;
      }
    }, 0);
  }

  private openWebViewModal(url: string): void {
    this.webViewUrl = url;
    this.webViewSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.isWebViewOpen = true;
  }

  closeWebView(): void {
    this.isWebViewOpen = false;
    this.webViewUrl = "";
    this.webViewSafeUrl = null;
    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 100);
  }

  /** Fallback: apri il sito in nuova scheda (se l'iframe è bloccato dal sito) */
  openWebViewInNewTab(): void {
    if (this.webViewUrl) window.open(this.webViewUrl, "_blank", "noopener");
  }

  // ========= SLIDE 3: VIDEO PRINCIPALE =========
  private setupIntersectionObserverForVideo() {
    this.io = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.6;
        this.isVideoActive = active;
        this.menu.enable(active);
        if (active) this.startVideo();
        else this.pauseVideo();
      },
      { threshold: [0, 0.6, 1] }
    );
    this.io.observe(this.videoSection.nativeElement);
  }

  private startVideo() {
    const v = this.slideVideo.nativeElement;
    if (!this.videoSrcSet) {
      v.src = this.VIDEO_SRC;
      this.videoSrcSet = true;
    }
    v.loop = true;
    v.muted = this.muted;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("webkit-playsinline", "true");
    v.play()
      .then(() => {
        this.isPlaying = true;
        this.tryUnmute();
      })
      .catch(() => {
        this.showUnmuteBtn = true;
      });
  }

  private pauseVideo(clear = false) {
    const v = this.slideVideo?.nativeElement;
    if (!v) return;
    v.pause();
    this.isPlaying = false;
    if (clear) {
      v.removeAttribute("src");
      v.load();
      this.videoSrcSet = false;
    }
  }

  private async tryUnmute() {
    if (!this.isVideoActive) return;
    const v = this.slideVideo.nativeElement;
    try {
      v.muted = false;
      await v.play();
      this.muted = false;
      this.showUnmuteBtn = false;
      this.isPlaying = true;
    } catch {
      v.muted = true;
      this.muted = true;
      this.showUnmuteBtn = true;
    }
  }

  private async forceUnlockAudio() {
    const v = this.slideVideo?.nativeElement;
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination);
        src.start(0);
      }
      if (v) {
        v.muted = false;
        await v.play();
        this.muted = false;
        this.showUnmuteBtn = false;
        this.isPlaying = true;
      }
    } catch {
      if (v) {
        v.muted = true;
        this.muted = true;
        this.showUnmuteBtn = true;
      }
    }
  }

  unmuteAndPlay() {
    this.forceUnlockAudio();
  }

  onVideoError(_ev: Event) {
    this.toastCtrl
      .create({
        message:
          "Il video non è disponibile. Se il problema persiste, contattaci su WhatsApp: +39 389 986 8381",
        duration: 7_000,
        position: "bottom",
        buttons: [
          {
            text: "QR WhatsApp",
            handler: () => this.openWhatsAppSafe(),
          },
        ],
      })
      .then((t) => t.present());
  }

  // ========= TOAST ASSISTENZA =========
  private setupFirstSlideObserver() {
    this.ioFirst = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.6;
        this.isFirstSlideActive = active;
        if (active) this.startSupportTimers();
        else this.clearSupportTimers();
      },
      { threshold: [0, 0.6, 1] }
    );
    this.ioFirst.observe(this.firstSlide.nativeElement);
  }

  private startSupportTimers() {
    this.clearSupportTimers();
    if (this.supportToastShown) return;
    this.supportDelayTimer = setTimeout(async () => {
      if (!this.isFirstSlideActive || this.supportToastShown) return;
      await this.showSupportToast();
      this.supportToastShown = true;
    }, this.SUPPORT_TOAST_DELAY_MS);
  }

  private clearSupportTimers() {
    if (this.supportDelayTimer) {
      clearTimeout(this.supportDelayTimer);
      this.supportDelayTimer = undefined;
    }
  }

  private async showSupportToast() {
    const toast = await this.toastCtrl.create({
      message:
        "Se noti malfunzionamenti o errori nel totem, contattaci su WhatsApp: +39 389 986 8381",
      position: "bottom",
      duration: this.SUPPORT_TOAST_DURATION_MS,
      cssClass: "toast-green",
      color: "success",
      buttons: [
        { text: "QR WhatsApp", handler: () => this.openWhatsAppSafe() },
        { text: "Chiudi", role: "cancel" },
      ],
    });
    await toast.present();
  }

  // WhatsApp
  openWhatsAppSafe() {
    const msg = "Ciao, nel totem ho notato un problema. Potete verificare?";
    const link = `https://wa.me/393899868381?text=${encodeURIComponent(msg)}`;
    this.supportWhatsappLink = link;
    this.supportQrSrc =
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
      encodeURIComponent(link);
    this.supportModalOpen = true;
  }

  async copyWhatsAppLink() {
    try {
      await navigator.clipboard.writeText(this.supportWhatsappLink);
      const t = await this.toastCtrl.create({
        message: "Link WhatsApp copiato negli appunti.",
        duration: 2000,
        position: "bottom",
      });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({
        message: "Impossibile copiare. Numero: +39 389 986 8381",
        duration: 3000,
        position: "bottom",
      });
      await t.present();
    }
  }

  // Menu & Nav
  async toggleMenu() {
    try {
      await this.menu.toggle();
    } catch {}
  }

  startApp() {
    this.router
      .navigateByUrl("/app/tabs/schedule", { replaceUrl: true })
      .catch((err) => console.error("Errore durante startApp:", err));
  }
}