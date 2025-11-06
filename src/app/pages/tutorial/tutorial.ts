import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
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
  IonCard,            // 👈 aggiunto
  IonCardContent      // 👈 aggiunto
} from "@ionic/angular/standalone";
import { IonContent as IonContentBase } from "@ionic/angular";
import { Storage } from "@ionic/storage-angular";
import { addIcons } from "ionicons";
import { arrowForward, close, menuOutline } from "ionicons/icons";
import { HttpClient } from "@angular/common/http";
import { CommonModule } from "@angular/common";

// Kiosk utility per calcolo top dinamico (header + meteo)
import { bindKioskUiTopAuto } from "../../shared/kiosk-ui-top";

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
    IonCard,          // 👈 aggiunto
    IonCardContent    // 👈 aggiunto
  ],
})
export class TutorialPage implements OnInit, AfterViewInit, OnDestroy {
  // ============== Services
  private menu = inject(MenuController);
  private router = inject(Router);
  private storage = inject(Storage);
  private http = inject(HttpClient);
  private toastCtrl = inject(ToastController);

  // ============== Header / UI state
  showSkip = true;

  // ============== Clock / Weather
  currentTime!: string;
  currentDate = "";
  weather: any;
  private weatherApiKey = "41266f28a33c8ef363049edf9b38275e";
  private weatherCity = "Castelraimondo";
  private clockInterval?: any;

  // ============== View refs
  @ViewChild("pageContent", { static: true }) pageContent!: IonContentBase;
  @ViewChild("firstSlide", { static: true }) firstSlide!: ElementRef<HTMLElement>;

  // ============== Slide 1: Carosello A3
  @ViewChild("adsTrack", { static: false }) adsTrack!: ElementRef<HTMLDivElement>;
  adsImages: string[] = [
    // "assets/poster/a3_01.jpg",
    // "assets/poster/a3_02.jpg",
    // "assets/poster/a3_03.jpg",
    // "assets/poster/a3_04.jpg",
    // "assets/poster/a3_05.jpg",
    // "assets/poster/a3_06.jpg",
    // "assets/poster/a3_07.jpg",
    // "assets/poster/a3_08.jpg",
    // "assets/poster/a3_09.jpg",
    "assets/poster/a3_11.jpg",
    "assets/poster/a3_12.jpg",
      "assets/poster/a3_13.jpg",
      "assets/poster/a3_14.jpg",
  ];
  adsIndex = 0;
  private readonly ADS_DURATION_MS = 10_000;
  private adsTimer?: any;
  private adsUserPause = false;
  private adsScrollDebounce?: any;

  // Modal immagine per il carosello
  isImageModalOpen = false;
  modalImageSrc = "";
  private modalAutoCloseTimer?: any;

  // ============== Slide 3: Video
  @ViewChild("slideVideo", { static: true }) slideVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild("videoSection", { static: true }) videoSection!: ElementRef<HTMLElement>;

  private readonly VIDEO_SRC = "assets/video/polveredistelle.mp4";
  muted = true;
  showUnmuteBtn = false;
  isPlaying = false;
  isVideoActive = false;
  private videoSrcSet = false;
  private io?: IntersectionObserver; // observer slide video

  // Gesto iniziale per sbloccare audio (solo slide video attiva)
  private firstGestureHandler = async () => {
    if (!this.isVideoActive) return;
    await this.forceUnlockAudio();
    if (!this.muted) {
      window.removeEventListener("pointerdown", this.firstGestureHandler, true);
      window.removeEventListener("keydown", this.firstGestureHandler, true);
    }
  };

  // ============== Toast assistenza (prima slide)
  private ioFirst?: IntersectionObserver;
  isFirstSlideActive = false;
  supportModalOpen = false;
  supportWhatsappLink = "";
  supportQrSrc = "";
  private supportDelayTimer?: any;
  private lastSupportToast = 0;
  private supportToastShown = false;

  private readonly SUPPORT_TOAST_DELAY_MS = 6_000;
  private readonly SUPPORT_TOAST_DURATION_MS = 12_000;
  private readonly SUPPORT_TOAST_COOLDOWN_MS = 12_000;

  // === INIZIO MODIFICA: bind/unbind per top dinamico (header + meteo) ===
  /** Disaccoppia il binding della misura quando la pagina viene distrutta */
  private unbindKiosk?: () => void;
  // === FINE MODIFICA ======================================================

  constructor() {
    addIcons({ arrowForward, close, menuOutline });
  }

  // ============== Lifecycle
  ngOnInit() {
    this.updateTimeAndDate();
    this.clockInterval = setInterval(() => this.updateTimeAndDate(), 1000);
    this.fetchWeather();
  }

  async ngAfterViewInit() {
    try {
      await this.pageContent.getScrollElement();
    } catch {}

    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
    this.startAdsCarousel();

    this.setupIntersectionObserverForVideo();
    this.setupFirstSlideObserver();

    window.addEventListener("pointerdown", this.firstGestureHandler, true);
    window.addEventListener("keydown", this.firstGestureHandler, true);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.isVideoActive) {
        this.startVideo();
      }
    });

    // === INIZIO MODIFICA: calcolo automatico dell’altezza top reale =========
    // Imposta :root{ --kiosk-ui-top: <px> } in base a header + box meteo,
    // aggiornandola automaticamente su resize/orientamento/mutazioni layout.
    this.unbindKiosk = bindKioskUiTopAuto({
      headerSelector: "ion-header",
      weatherBoxSelector: ".info-kiosk",
      cssVarName: "--kiosk-ui-top",
      log: false, // porta a true se vuoi vedere i log di diagnostica
    });
    // === FINE MODIFICA =====================================================
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.stopAdsCarousel();
    if (this.io) this.io.disconnect();
    if (this.ioFirst) this.ioFirst.disconnect();

    window.removeEventListener("pointerdown", this.firstGestureHandler, true);
    window.removeEventListener("keydown", this.firstGestureHandler, true);

    this.pauseVideo(true);
    this.menu.enable(true);

    this.clearSupportTimers();
    this.supportToastShown = false;

    // === INIZIO MODIFICA: sgancio listener misura top dinamico =============
    this.unbindKiosk?.();
    // === FINE MODIFICA =====================================================
  }

  // ============== Clock / Weather
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

  // ============== Carosello (slide 1)
  startAdsCarousel() {
    if (!this.adsImages.length) return;
    this.stopAdsCarousel();
    this.adsTimer = setInterval(() => {
      if (this.adsUserPause) return;
      const next = (this.adsIndex + 1) % this.adsImages.length;
      this.goToAd(next);
    }, this.ADS_DURATION_MS);
  }

  stopAdsCarousel() {
    if (this.adsTimer) {
      clearInterval(this.adsTimer);
      this.adsTimer = undefined;
    }
  }

  goToAd(i: number, behavior: ScrollBehavior = "smooth") {
    this.adsIndex = Math.max(0, Math.min(i, this.adsImages.length - 1));
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const x = this.adsIndex * track.clientWidth;
    track.scrollTo({ left: x, behavior });
  }

  onAdsScroll() {
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const w = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== this.adsIndex) this.adsIndex = idx;

    this.pauseAdsCarousel();
    clearTimeout(this.adsScrollDebounce);
    this.adsScrollDebounce = setTimeout(() => this.resumeAdsCarousel(), 2500);
  }

  pauseAdsCarousel(user = false) {
    if (user) this.adsUserPause = true;
    this.stopAdsCarousel();
  }

  resumeAdsCarousel() {
    this.adsUserPause = false;
    this.startAdsCarousel();
  }

  removeBrokenAd(i: number) {
    const missing = this.adsImages[i];
    console.warn("[Carosello] Immagine mancante o non accessibile, rimuovo:", missing);
    this.adsImages.splice(i, 1);
    if (!this.adsImages.length) {
      this.stopAdsCarousel();
      return;
    }
    this.adsIndex = Math.min(this.adsIndex, this.adsImages.length - 1);
    setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
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
    if (this.modalAutoCloseTimer) {
      clearTimeout(this.modalAutoCloseTimer);
      this.modalAutoCloseTimer = undefined;
    }
  }

  // ============== Video (slide 3)
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
    v
      .play()
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
    if (!this.isVideoActive) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch {}
    const v = this.slideVideo?.nativeElement;
    if (!v) return;
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

  unmuteAndPlay() {
    this.forceUnlockAudio();
  }

  onVideoError(_ev: Event) {
    this.toastCtrl
      .create({
        message:
          "Il video non è disponibile. Se il problema persiste, contattaci su WhatsApp: +39 389 986 8381",
        duration: 7000,
        position: "bottom",
        buttons: [{ text: "QR WhatsApp", handler: () => this.openWhatsAppSafe() }],
      })
      .then((t) => t.present());
  }

  // ============== Toast assistenza (prima slide)
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
      this.lastSupportToast = Date.now();
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

  // ============== WhatsApp: modal con QR
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

  // ============== Menu & Nav
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
