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
  IonFooter,
  IonModal,
  MenuController,
  ToastController,
  IonCard,
  IonCardContent
} from "@ionic/angular/standalone";
import { IonContent as IonContentBase } from "@ionic/angular";
import { Storage } from "@ionic/storage-angular";
import { addIcons } from "ionicons";
import { arrowForward, close, menuOutline } from "ionicons/icons";
import { HttpClient } from "@angular/common/http";
import { CommonModule } from "@angular/common";
import { bindKioskUiTopAuto } from "../../shared/kiosk-ui-top";

/** Item del carosello */
type AdItem = { kind: "image" | "video"; src: string; poster?: string };

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
    IonFooter,
    IonModal,
    IonCard,
    IonCardContent
  ],
})
export class TutorialPage implements OnInit, AfterViewInit, OnDestroy {
  // Services
  private menu = inject(MenuController);
  private router = inject(Router);
  private storage = inject(Storage);
  private http = inject(HttpClient);
  private toastCtrl = inject(ToastController);

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
  @ViewChild("firstSlide", { static: true }) firstSlide!: ElementRef<HTMLElement>;

  // Slide 1: Carosello
  @ViewChild("adsTrack", { static: false }) adsTrack!: ElementRef<HTMLDivElement>;
  @ViewChildren("adVideo") adVideoEls!: QueryList<ElementRef<HTMLVideoElement>>;

  ads: AdItem[] = [
    { kind: "image", src: "assets/poster/a3_11.jpg" },
    { kind: "image", src: "assets/poster/a3_12.jpg" },
    { kind: "image", src: "assets/poster/a3_13.jpg" },
    { kind: "image", src: "assets/poster/a3_14.jpg" },
    { kind: "video", src: "assets/poster/eclissi.mp4" }, // video carosello
  ];
  adsIndex = 0;

  private readonly ADS_DURATION_MS = 10_000;
  private adsTimer?: any;
  private adsUserPause = false;
  private adsScrollDebounce?: any;

  // Video carosello: auto-duration + audio
  private adDurationsMs: number[] = [];
  private readonly VIDEO_FALLBACK_MS = 15000;
  private videoAdAdvanceTimer?: any;
  adsMuted = true;
  adsShowUnmuteBtn = false;

  // Modal immagine
  isImageModalOpen = false;
  modalImageSrc = "";
  private modalAutoCloseTimer?: any;

  // Slide 3: Video principale
  @ViewChild("slideVideo", { static: true }) slideVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild("videoSection", { static: true }) videoSection!: ElementRef<HTMLElement>;
  private readonly VIDEO_SRC = "assets/video/polveredistelle.mp4";
  muted = true;
  showUnmuteBtn = false;
  isPlaying = false;
  isVideoActive = false;
  private videoSrcSet = false;
  private io?: IntersectionObserver;

  // Primo gesto: ora sblocca anche il video del carosello
  private firstGestureHandlerAll = () => {
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

  // Top dinamico
  private unbindKiosk?: () => void;

  // Observer per i video del carosello
  private adVideoIO?: IntersectionObserver;

  constructor() {
    addIcons({ arrowForward, close, menuOutline });
  }

  // Lifecycle
  ngOnInit() {
    this.updateTimeAndDate();
    this.clockInterval = setInterval(() => this.updateTimeAndDate(), 1000);
    this.fetchWeather();
  }

  async ngAfterViewInit() {
    try { await this.pageContent.getScrollElement(); } catch {}

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
    window.addEventListener("pointerdown", this.firstGestureHandlerAll, { capture: true, passive: true });
    window.addEventListener("keydown", this.firstGestureHandlerAll, { capture: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (this.isCurrentAdVideo) this.ensureAdVideoPlaying(this.adsIndex);
        if (this.isVideoActive) this.startVideo();
      }
    });

    // Misura top dinamico
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

    window.removeEventListener("pointerdown", this.firstGestureHandlerAll, true);
    window.removeEventListener("keydown", this.firstGestureHandlerAll, true);

    this.pauseVideo(true);
    this.menu.enable(true);
    this.clearSupportTimers();
    this.supportToastShown = false;
    this.unbindKiosk?.();
  }

  // Clock / Weather
  updateTimeAndDate() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    this.currentDate = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  }
  fetchWeather() {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.weatherCity}&appid=${this.weatherApiKey}&units=metric&lang=it`;
    this.http.get(url).subscribe({
      next: (data) => (this.weather = data),
      error: (err) => console.error("Errore meteo:", err),
    });
  }

  // Carosello
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
  stopAdsCarousel() { if (this.adsTimer) { clearInterval(this.adsTimer); this.adsTimer = undefined; } }

  private pauseAllAdVideos(resetTime = true) {
    this.adVideoEls?.forEach((ref) => {
      const v = ref.nativeElement;
      try { v.pause(); if (resetTime) v.currentTime = 0; } catch {}
    });
  }

  /** Observer: fa partire i video quando sono realmente in vista */
  private bindAdVideoObserver() {
    try { this.adVideoIO?.disconnect(); } catch {}
    if (!this.adVideoEls || !this.adVideoEls.length) return;

    this.adVideoIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          const idx = this.adVideoEls.toArray().findIndex((r) => r.nativeElement === v);
          if (idx < 0) return;
          if (e.isIntersecting && e.intersectionRatio > 0.6) this.ensureAdVideoPlaying(idx);
        });
      },
      { threshold: [0, 0.6, 1], root: null }
    );
    this.adVideoEls.forEach((r) => this.adVideoIO!.observe(r.nativeElement));
  }

  /** Avvio robusto del video n-esimo con retry progressivi */
  private ensureAdVideoPlaying(i: number) {
    const v = this.adVideoEls?.toArray()[i]?.nativeElement;
    if (!v) return;

    // proprietà + attributi richiesti su iOS
    v.muted = true;
    v.setAttribute("muted", "");          // importante su Safari
    (v as any).playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "true");
    v.autoplay = true;

    const tryPlay = (tries = 6) => {
      try {
        // alcuni device gradiscono un load() prima del play()
        v.load();
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            // appena parte, prova l’auto-unmute come la slide video principale
            this.tryUnmuteAd(i);
          }).catch(() => {
            if (tries > 0) setTimeout(() => tryPlay(tries - 1), 300);
            else { this.adsMuted = true; this.adsShowUnmuteBtn = true; }
          });
        }
      } catch {
        if (tries > 0) setTimeout(() => tryPlay(tries - 1), 300);
        else { this.adsMuted = true; this.adsShowUnmuteBtn = true; }
      }
    };

    // riprova anche su eventi media
    const once = (ev: keyof HTMLVideoElementEventMap, fn: any) => {
      const h = () => { v.removeEventListener(ev, h as any); fn(); };
      v.addEventListener(ev, h as any, { once: true });
    };
    once("loadeddata", () => tryPlay(4));
    once("canplaythrough", () => tryPlay(4));

    tryPlay();
  }

  private enterVideoAd(i: number) {
    this.stopAdsCarousel();
    this.clearVideoAdAdvance();
    this.ensureAdVideoPlaying(i);

    const v = this.adVideoEls?.toArray()[i]?.nativeElement;
    if (!v) return;

    const durMs = Number.isFinite(this.adDurationsMs[i])
      ? this.adDurationsMs[i]
      : (Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : this.VIDEO_FALLBACK_MS);

    this.videoAdAdvanceTimer = setTimeout(() => {
      this.goToAd((i + 1) % this.ads.length);
    }, Math.max(1000, durMs + 300));
  }

  private leaveVideoAd() { this.clearVideoAdAdvance(); }
  private clearVideoAdAdvance() {
    if (this.videoAdAdvanceTimer) { clearTimeout(this.videoAdAdvanceTimer); this.videoAdAdvanceTimer = undefined; }
  }

  private async tryUnmuteAd(i: number) {
    const v = this.adVideoEls?.toArray()[i]?.nativeElement;
    if (!v) return;
    try {
      v.muted = false;
      await v.play();
      this.adsMuted = false;
      this.adsShowUnmuteBtn = false;
    } catch {
      v.muted = true;
      this.adsMuted = true;
      this.adsShowUnmuteBtn = true;
    }
  }

  goToAd(i: number, behavior: ScrollBehavior = "smooth") {
    const prev = this.ads[this.adsIndex];
    if (prev?.kind === "video") this.leaveVideoAd();

    this.adsIndex = Math.max(0, Math.min(i, this.ads.length - 1));
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const x = this.adsIndex * track.clientWidth;
    track.scrollTo({ left: x, behavior });

    const current = this.ads[this.adsIndex];
    this.pauseAllAdVideos(false);
    if (current?.kind === "video") this.enterVideoAd(this.adsIndex);
    else this.startAdsCarousel();
  }

  onAdsScroll() {
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const w = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== this.adsIndex) {
      const prev = this.ads[this.adsIndex];
      if (prev?.kind === "video") this.leaveVideoAd();

      this.adsIndex = idx;
      this.pauseAllAdVideos(false);

      const current = this.ads[this.adsIndex];
      if (current?.kind === "video") this.enterVideoAd(this.adsIndex);
      else this.startAdsCarousel();
    }

    this.pauseAdsCarousel();
    clearTimeout(this.adsScrollDebounce);
    this.adsScrollDebounce = setTimeout(() => this.resumeAdsCarousel(), 2500);
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
    this.ads.splice(i, 1);
    if (!this.ads.length) { this.stopAdsCarousel(); this.clearVideoAdAdvance(); return; }
    this.adsIndex = Math.min(this.adsIndex, this.ads.length - 1);
    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
  }

  // eventi video carosello
  onAdVideoMeta(i: number, ev: Event) {
    const v = ev?.target as HTMLVideoElement;
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      this.adDurationsMs[i] = v.duration * 1000;
    }
  }
  onAdVideoEnded(i: number) {
    this.clearVideoAdAdvance();
    this.goToAd((i + 1) % this.ads.length);
  }

  // CTA audio carosello
  get isCurrentAdVideo(): boolean { return this.ads[this.adsIndex]?.kind === "video"; }
  get showAdsAudioCta(): boolean { return this.isCurrentAdVideo && this.adsShowUnmuteBtn; }
  toggleAdsAudio() {
    const v = this.adVideoEls?.toArray()[this.adsIndex]?.nativeElement;
    if (!v) return;
    try { v.muted = false; v.play().catch(() => {}); this.adsMuted = false; this.adsShowUnmuteBtn = false; } catch {}
  }

  // Modal immagine
  openImageFull(src: string): void {
    this.modalImageSrc = src;
    this.isImageModalOpen = true;
    if (this.modalAutoCloseTimer) clearTimeout(this.modalAutoCloseTimer);
    this.modalAutoCloseTimer = setTimeout(() => this.closeImageFull(), 10_000);
  }
  closeImageFull(): void {
    this.isImageModalOpen = false;
    if (this.modalAutoCloseTimer) { clearTimeout(this.modalAutoCloseTimer); this.modalAutoCloseTimer = undefined; }
  }

  // Slide 3: Video principale (come prima)
  private setupIntersectionObserverForVideo() {
    this.io = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.6;
        this.isVideoActive = active;
        this.menu.enable(active);
        if (active) this.startVideo(); else this.pauseVideo();
      },
      { threshold: [0, 0.6, 1] }
    );
    this.io.observe(this.videoSection.nativeElement);
  }

  private startVideo() {
    const v = this.slideVideo.nativeElement;
    if (!this.videoSrcSet) { v.src = this.VIDEO_SRC; this.videoSrcSet = true; }
    v.loop = true;
    v.muted = this.muted;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("webkit-playsinline", "true");
    v.play().then(() => { this.isPlaying = true; this.tryUnmute(); })
            .catch(() => { this.showUnmuteBtn = true; });
  }
  private pauseVideo(clear = false) {
    const v = this.slideVideo?.nativeElement;
    if (!v) return;
    v.pause(); this.isPlaying = false;
    if (clear) { v.removeAttribute("src"); v.load(); this.videoSrcSet = false; }
  }
  private async tryUnmute() {
    if (!this.isVideoActive) return;
    const v = this.slideVideo.nativeElement;
    try { v.muted = false; await v.play(); this.muted = false; this.showUnmuteBtn = false; this.isPlaying = true; }
    catch { v.muted = true; this.muted = true; this.showUnmuteBtn = true; }
  }
  private async forceUnlockAudio() {
    const v = this.slideVideo?.nativeElement;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) { const ctx = new Ctx(); if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createBufferSource(); src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination); src.start(0);
      }
      if (v) { v.muted = false; await v.play(); this.muted = false; this.showUnmuteBtn = false; this.isPlaying = true; }
    } catch { if (v) { v.muted = true; this.muted = true; this.showUnmuteBtn = true; } }
  }
  unmuteAndPlay() { this.forceUnlockAudio(); }

  onVideoError(_ev: Event) {
    this.toastCtrl.create({
      message: "Il video non è disponibile. Se il problema persiste, contattaci su WhatsApp: +39 389 986 8381",
      duration: 7000, position: "bottom",
      buttons: [{ text: "QR WhatsApp", handler: () => this.openWhatsAppSafe() }],
    }).then((t) => t.present());
  }

  // Toast assistenza
  private setupFirstSlideObserver() {
    this.ioFirst = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.6;
        this.isFirstSlideActive = active;
        if (active) this.startSupportTimers(); else this.clearSupportTimers();
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
    if (this.supportDelayTimer) { clearTimeout(this.supportDelayTimer); this.supportDelayTimer = undefined; }
  }
  private async showSupportToast() {
    const toast = await this.toastCtrl.create({
      message: "Se noti malfunzionamenti o errori nel totem, contattaci su WhatsApp: +39 389 986 8381",
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
    this.supportQrSrc = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(link);
    this.supportModalOpen = true;
  }
  async copyWhatsAppLink() {
    try {
      await navigator.clipboard.writeText(this.supportWhatsappLink);
      const t = await this.toastCtrl.create({ message: "Link WhatsApp copiato negli appunti.", duration: 2000, position: "bottom" });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({ message: "Impossibile copiare. Numero: +39 389 986 8381", duration: 3000, position: "bottom" });
      await t.present();
    }
  }

  // Menu & Nav
  async toggleMenu() { try { await this.menu.toggle(); } catch {} }
  startApp() {
    this.router
      .navigateByUrl("/app/tabs/schedule", { replaceUrl: true })
      .catch((err) => console.error("Errore durante startApp:", err));
  }
}
