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
  HostBinding,
  HostListener,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from "@angular/router";
import {
  catchError,
  EMPTY,
  filter,
  map,
  Subscription,
  switchMap,
  take,
} from "rxjs";
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
import { arrowForward, close, menuOutline, playCircle, pricetagsOutline } from "ionicons/icons";
import { HttpClient } from "@angular/common/http";
import { CommonModule } from "@angular/common";
import { bindKioskUiTopAuto } from "../../shared/kiosk-ui-top";
import { KioskApiService } from "../../providers/kiosk-api.service";
import { ConferenceService } from "../../providers/conference.service";
import type { KioskBannerDto, KioskPublicBusinessDto } from "../../interfaces/kiosk-api.interfaces";
import type { Speaker } from "../../interfaces/conference.interfaces";
import { environment } from "../../../environments/environment";
import { kioskDevInfo, kioskDevLog, kioskDevWarn } from "../../utils/kiosk-dev-console";

/**
 * Slide carosello home kiosk: ogni attività ha al massimo 1 poster.
 * Tap → dettaglio interno `/app/tabs/speakers/speaker-details/:activitySlug` (param route: `speakerId`).
 * Nessun URL esterno: eventuali link dal backend vengono scartati con log 🔒.
 */
type AdItem = {
  kind: "image" | "video";
  src: string;
  fallbackSrc?: string;
  poster?: string;
  /** Slug attività (da business_slug / slug API) → solo `/speaker-details/:slug` */
  activitySlug?: string;
  businessName?: string;
  title?: string;
  subtitle?: string;
  uploadedBy?: string;
  multiHomePosters?: boolean;
};

/**
 * Banner promozionali orizzontali (`/promo-banners`): separati dai poster 4:5.
 * Tap ammesso solo verso dettaglio interno attività; CTA http(s) esterne → bloccate con log 🔒.
 */
type PromoAdItem = {
  src: string;
  title?: string;
  subtitle?: string;
  businessName?: string;
  /** Se assente o esterno bloccato, il tap mostra solo feedback (nessuna uscita dal totem). */
  activitySlug?: string;
  blockedExternal?: boolean;
};

/**
 * Slug ammessi per `/speaker-details/:slug` (stesso vincolo backend `isValidPublicSlug`).
 * Blocca path injection, `..`, segmenti con caratteri strani — solo navigazione interna sicura.
 */
function safeKioskBusinessSlug(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s || s.length > 160) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return null;
  return s;
}

/**
 * Normalizza candidate slug provenienti da payload eterogenei:
 * - slug puro: "la-lanterna"
 * - route interna: "/app/tabs/speakers/speaker-details/la-lanterna"
 * - URL assoluto con query/hash
 */
function normalizeKioskBusinessSlugCandidate(raw: string | null | undefined): string | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  const trySlug = (v: string): string | null => {
    try {
      return safeKioskBusinessSlug(decodeURIComponent(v));
    } catch {
      return safeKioskBusinessSlug(v);
    }
  };

  const direct = trySlug(input);
  if (direct) return direct;

  let pathLike = input;
  if (/^https?:\/\//i.test(pathLike)) {
    try {
      const u = new URL(pathLike);
      pathLike = `${u.pathname || ""}`.trim();
    } catch {
      // fallback: uso stringa originale
    }
  }

  pathLike = pathLike.split("#")[0].split("?")[0].replace(/\\/g, "/");
  const segs = pathLike
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segs.length) return null;

  const idx = segs.findIndex((s) => s.toLowerCase() === "speaker-details");
  if (idx >= 0 && segs[idx + 1]) {
    const fromRoute = trySlug(segs[idx + 1]);
    if (fromRoute) return fromRoute;
  }

  return trySlug(segs[segs.length - 1] || "");
}

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
  /** Per CSS: dock crediti duplicato nascosto in layout fit-screen (crediti restano nel footer scroll). */
  @HostBinding("class.kiosk-tutorial--fit-screen")
  fitScreenLayout = true;

  // Services
  private menu = inject(MenuController);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storage = inject(Storage);
  private http = inject(HttpClient);
  private toastCtrl = inject(ToastController);
  private kioskApi = inject(KioskApiService);
  private confService = inject(ConferenceService);
  private cdr = inject(ChangeDetectorRef);

  // Header / UI
  showSkip = true;
  readonly appVersion = environment.appVersion || '0';

  /**
   * Home kiosk in `/app/tabs/*`: c’è ion-tab-bar → il dock crediti si ancorà sopra di essa.
   * Su `/tutorial` (redirect root) la tab bar non c’è → ancoraggio solo su safe-area.
   */
  creditsDockTabsLayout = false;
  private creditsDockNavSub?: Subscription;

  // Clock / Weather
  currentTime!: string;
  currentDate = "";
  weather: any;
  private clockInterval?: any;

  // View refs
  @ViewChild("pageContent", { static: true }) pageContent!: IonContentBase;
  @ViewChild("firstSlide", { static: true })
  firstSlide!: ElementRef<HTMLElement>;

  // Slide 1: Carosello
  @ViewChild("adsTrack", { static: false })
  adsTrack!: ElementRef<HTMLDivElement>;
  @ViewChild("promoStrip", { static: false })
  promoStripRef?: ElementRef<HTMLDivElement>;
  @ViewChildren("adVideo") adVideoEls!: QueryList<ElementRef<HTMLVideoElement>>;

  /** Poster home verticali: primario GET `/banners`, poi fallback /home, /home-posters, businesses, JSON locale. */
  ads: AdItem[] = [];
  /** Striscia opzionale sotto il carosello: GET `/promo-banners` (CTA orizzontali, non mescolati ai 4:5). */
  promoAds: PromoAdItem[] = [];
  adsIndex = 0;

  /** Avanzamento automatico poster (immagini); i video non-click-to-play bloccano il tick fino a fine clip. */
  private readonly ADS_DURATION_MS = 10_000;
  private adsTimer?: any;
  private idlePosterEnabled = true;
  /** Default 60 s — allineato a settings DB / app.component inattività globale. */
  private idlePosterTimeoutMs = 60_000;
  private idlePosterRotationMs = 10_000;
  private idlePosterMode = false;
  private forceIdlePosterOnNextAdsLoad = false;
  private idlePosterTimer?: ReturnType<typeof setTimeout>;
  private idlePosterRotateTimer?: ReturnType<typeof setInterval>;

  /** Strip “In evidenza” (promo-banners): scroll orizzontale automatico (stesso intervallo del poster `ADS_DURATION_MS`). */
  private promoAutoTimer?: ReturnType<typeof setInterval>;
  private promoAutoIndex = 0;
  /** Indice card evidenziata (dots + animazione); allineato a `promoAutoIndex` dopo ogni avanzamento. */
  promoStripActiveIndex = 0;
  /** Dopo interazione utente sulla strip, pausa auto-scroll (ms epoch). */
  private promoStripPauseUntil = 0;
  private adsUserPause = false;
  private adsScrollDebounce?: any;

  /** Video che partono solo al tap su Play; stesso timer dei poster (10s) se non si preme Play */
  private readonly CLICK_TO_PLAY_VIDEO_SRCS = ["eclissi.mp4", "bar centrale_TikTok.mp4"];
  adsShowPlayBtn = false;
  private adsPlayBtnHideTimer?: ReturnType<typeof setTimeout>;

  // Video carosello: auto-duration + audio
  private adDurationsMs: number[] = [];
  private readonly VIDEO_FALLBACK_MS = 15_000;
  private videoAdAdvanceTimer?: any;
  /** Totem kiosk: audio poster video ON di default (Windows 32"). */
  private readonly isTotemKiosk = !!(environment as { kioskStrictMode?: boolean }).kioskStrictMode;
  adsMuted = false;
  adsShowUnmuteBtn = false;
  /** Preferenza audio carosello poster — default ON su totem. */
  adsAudioWanted = !!(environment as { kioskStrictMode?: boolean }).kioskStrictMode;

  // Modal immagine
  isImageModalOpen = false;
  modalImageSrc = "";
  private modalAutoCloseTimer?: any;

  /** “In evidenza”: anteprima banner a schermo intero (tap sulla card). */
  promoFullscreenOpen = false;
  promoFullscreenItem: PromoAdItem | null = null;
  posterFullscreenOpen = false;
  posterFullscreenItem: AdItem | null = null;

  /** Immagine neutra se il poster API manca o fallisce il caricamento (ratio ~4:5, vedi commenti SCSS). */
  private readonly POSTER_PLACEHOLDER = "assets/img/kiosk-poster-placeholder.svg";

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
  private adsAudioUnlocked = !!(environment as { kioskStrictMode?: boolean }).kioskStrictMode;

  /** True solo se l’utente ha richiesto audio esplicitamente (tap CTA). */
  private adsAudioWantedManual = false;
  // ===== FINE MODIFICA =====

  // Primo gesto: ora sblocca anche il video del carosello
  private firstGestureHandlerAll = () => {
    // ===== INIZIO MODIFICA =====
    // ✅ memorizzo che l’utente ha fatto un gesto: ora l’audio può essere “consentito”
    // ma lo abilitiamo SOLO quando l’utente lo chiede (adsAudioWanted).
    this.adsAudioUnlocked = true;
    if (this.isTotemKiosk) this.adsAudioWanted = true;

    if (this.isCurrentAdVideo && this.adsAudioWanted) {
      void this.tryUnmuteAd(this.adsIndex);
    } else {
      this.adsShowUnmuteBtn = this.isCurrentAdVideo && this.adsMuted && this.adsAudioWanted;
    }
    // ===== FINE MODIFICA =====

    if (!this.isClickToPlayVideo(this.adsIndex)) this.ensureAdVideoPlaying(this.adsIndex);
    this.forceUnlockAudio(); // per la slide video principale se attiva
  };

  // Assistenza home (banner sopra tab bar + modal QR)
  private ioFirst?: IntersectionObserver;
  /** Slide poster visibile: hint dock fisso + padding scroll (default true per prima paint). */
  isFirstSlideActive = true;
  supportModalOpen = false;
  supportWhatsappLink = "";
  supportQrSrc = "";
  supportQrLoading = false;
  /** Banner “contattaci WhatsApp” dopo delay sulla slide poster */
  supportBannerVisible = false;
  /** Cache-buster immagini: cambia a ogni reload feed poster/promo. */
  private assetCacheVersion = Date.now();
  /** Polling feed pubblico: confronto versione server per refresh banner/promo solo quando cambia. */
  private readonly FEED_VERSION_POLL_MS = this.resolveFeedVersionPollMs();
  private readonly FEED_HARD_REFRESH_MS = this.resolveFeedHardRefreshMs();
  private feedVersionPollTimer?: ReturnType<typeof setInterval>;
  private feedVersionInFlight = false;
  private lastFeedVersion = "";
  private lastFeedHardRefreshAt = 0;
  private fullscreenSwipeStartX: number | null = null;
  private fullscreenSwipeStartY: number | null = null;
  private readonly FULLSCREEN_SWIPE_THRESHOLD_PX = 42;
  private readonly FULLSCREEN_SWIPE_MAX_OFF_AXIS_PX = 72;
  private supportDelayTimer?: any;
  private supportAssistPromptShown = false;
  private readonly SUPPORT_BANNER_DELAY_MS = 6_000;

  // Top dinamico (header + box meteo)
  private unbindKiosk?: () => void;

  // Observer per i video del carosello
  private adVideoIO?: IntersectionObserver;

  constructor() {
    addIcons({ arrowForward, close, menuOutline, playCircle, pricetagsOutline });

    // ===== INIZIO MODIFICA =====
    // Cache dei video presenti in `ads` (serve per mappare video DOM ↔ adsIndex)
    this.rebuildVideoAdIndexes();
    // ===== FINE MODIFICA =====
  }

  // Lifecycle
  ngOnInit() {
    this.forceIdlePosterOnNextAdsLoad = this.route.snapshot.queryParamMap.get("idleFs") === "1";
    if (this.forceIdlePosterOnNextAdsLoad) {
      void this.router
        .navigate([], {
          relativeTo: this.route,
          replaceUrl: true,
          queryParamsHandling: "merge",
          queryParams: { idleFs: null },
        })
        .catch(() => {});
    }

    this.syncCreditsDockTabsLayout();
    this.creditsDockNavSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncCreditsDockTabsLayout();
        // Se cambio route mentre una fullscreen è aperta, la richiudo sempre
        // per evitare overlay residui sopra la nuova pagina.
        if (this.posterFullscreenOpen) this.closePosterFullscreen();
        if (this.promoFullscreenOpen) this.closePromoFullscreen(undefined, "router-nav");
      });

    this.updateTimeAndDate();
    this.clockInterval = setInterval(() => this.updateTimeAndDate(), 1000);
    this.fetchWeather();
    this.loadIdlePosterRuntimeConfig();
    /** Carosello poster e strip promo sono indipendenti: due GET paralleli quando l’API è attiva. */
    this.loadBannerCarousel();
    this.loadPromoStrip();
    this.startFeedVersionPolling();
  }

  async ngAfterViewInit() {
    try {
      await this.pageContent.getScrollElement();
    } catch {}

    // Carosello: parte solo se gli slide sono già stati caricati (altrimenti dopo GET banners)
    if (this.ads.length) {
      setTimeout(() => this.goToAd(this.adsIndex, "auto"), 0);
      this.startAdsCarousel();
    }

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
        if (this.isCurrentAdVideo && !this.isClickToPlayVideo(this.adsIndex))
          this.ensureAdVideoPlaying(this.adsIndex);
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

    this.scheduleIdlePosterMode();
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);

    this.stopAdsCarousel();
    this.stopPromoStripAuto();
    this.clearVideoAdAdvance();
    this.clearAdsPlayBtnTimer();

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
    this.supportAssistPromptShown = false;
    this.supportBannerVisible = false;
    this.unbindKiosk?.();
    this.creditsDockNavSub?.unsubscribe();
    this.clearIdlePosterTimers();
    this.stopFeedVersionPolling();
  }

  private syncCreditsDockTabsLayout(): void {
    const path = (this.router.url.split("?")[0] ?? "").toLowerCase();
    this.creditsDockTabsLayout = path.includes("/app/tabs");
    this.fitScreenLayout = path === "/tutorial" || path === "/app/tabs/home";
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
    const key = environment.weatherOpenWeatherApiKey?.trim();
    const city = environment.weatherCity?.trim() || "Castelraimondo,it";
    if (key) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=it`;
      this.http.get(url).subscribe({
        next: (data) => (this.weather = data),
        error: (err) => kioskDevWarn("🌤️⚠️ [Tutorial] OpenWeather KO:", err?.message || err),
      });
      return;
    }
    this.fetchWeatherOpenMeteo(city);
  }

  /**
   * Meteo senza API key: Open-Meteo (geocoding + current_weather, CORS ok dal browser).
   * Stesso shape di OpenWeather usato dal template (`name`, `weather[0].description`, `main.temp`).
   */
  private fetchWeatherOpenMeteo(cityQuery: string): void {
    const cityName = cityQuery.split(",")[0]?.trim() || cityQuery;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=it&format=json`;
    this.http
      .get<{
        results?: Array<{ name: string; latitude: number; longitude: number }>;
      }>(geoUrl)
      .pipe(
        switchMap((geo) => {
          const r = geo?.results?.[0];
          if (!r) {
            kioskDevWarn("🌤️⚠️ [Tutorial] Open-Meteo geocoding: nessun risultato per", cityName);
            return EMPTY;
          }
          const fwUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}` +
            `&current_weather=true&timezone=Europe%2FRome`;
          return this.http
            .get<{ current_weather?: { temperature: number; weathercode: number } }>(fwUrl)
            .pipe(map((fw) => ({ r, fw })));
        }),
        catchError((e) => {
          kioskDevWarn("🌤️⚠️ [Tutorial] Open-Meteo KO:", e?.message || e);
          return EMPTY;
        })
      )
      .subscribe((pair) => {
        if (!pair) return;
        const cw = pair.fw?.current_weather;
        if (!cw) {
          kioskDevWarn("🌤️⚠️ [Tutorial] Open-Meteo: current_weather assente");
          return;
        }
        this.weather = {
          name: pair.r.name || cityName,
          weather: [{ description: this.describeWmoWeatherCodeIt(cw.weathercode) }],
          main: { temp: cw.temperature },
        };
      });
  }

  /** Codici WMO come restituiti da Open-Meteo `current_weather.weathercode` (testi brevi IT). */
  private describeWmoWeatherCodeIt(code: number): string {
    const m: Record<number, string> = {
      0: "Cielo sereno",
      1: "Prevalentemente sereno",
      2: "Parzialmente nuvoloso",
      3: "Coperto",
      45: "Nebbia",
      48: "Nebbia con brina",
      51: "Pioggerella leggera",
      53: "Pioggerella moderata",
      55: "Pioggerella intensa",
      56: "Pioggerella congelantesi leggera",
      57: "Pioggerella congelantesi intensa",
      61: "Pioggia leggera",
      63: "Pioggia moderata",
      65: "Pioggia forte",
      66: "Pioggia congelantesi leggera",
      67: "Pioggia congelantesi forte",
      71: "Nevicata leggera",
      73: "Nevicata moderata",
      75: "Nevicata forte",
      77: "Granelli di neve",
      80: "Rovesci leggeri",
      81: "Rovesci moderati",
      82: "Rovesci violenti",
      85: "Rovesci di neve leggeri",
      86: "Rovesci di neve forti",
      95: "Temporale",
      96: "Temporale con grandine leggera",
      99: "Temporale con grandine forte",
    };
    return m[code] ?? `Condizioni (codice ${code})`;
  }

  /**
   * Carosello poster home verticali (4:5): 1 slide per attività, tap → dettaglio interno.
   * Ordine backend concordato: **GET /banners** come sorgente primaria (stesso feed di `homePosters` in GET /home),
   * poi GET /home, /home-posters, lista businesses, infine JSON locale.
   */
  private loadBannerCarousel(): void {
    if (!environment.useKioskPublicApi) {
      kioskDevLog(
        "📁 [Tutorial] useKioskPublicApi=false — poster home da data.json (solo listingTier premium)"
      );
      this.loadFallbackBannersJson();
      return;
    }
    this.kioskApi.getBanners().subscribe({
      next: (raw) => {
        const mapped = this.buildAdsFromBannerPayload(raw);
        const ready = this.dedupeAndSortPosters(mapped);
        if (ready.length) {
          this.ads = ready;
          kioskDevLog(
            "✅ [Tutorial] Poster home da GET /api/public-kiosk/banners —",
            this.ads.length,
            "attività"
          );
          this.afterBannerAdsLoaded();
          return;
        }
        kioskDevLog(
          "📎 [Tutorial] GET /banners vuoto — fallback GET /api/public-kiosk/home (homePosters/banners)"
        );
        this.loadHomeFallbackSequence();
      },
      error: () => {
        kioskDevWarn(
          "⚠️ [Tutorial] GET /banners KO — fallback GET /api/public-kiosk/home"
        );
        this.loadHomeFallbackSequence();
      },
    });
  }

  /** Dopo `/banners` vuoto o errore: stesso elenco poster dentro GET `/home`, poi catena leggera. */
  private loadHomeFallbackSequence(): void {
    this.kioskApi.getHome().subscribe({
      next: (raw) => {
        const mapped = this.buildAdsFromBannerDtos(
          this.kioskApi.unwrapHomePosters(raw)
        );
        const ready = this.dedupeAndSortPosters(mapped);
        if (ready.length) {
          this.ads = ready;
          kioskDevLog(
            "✅ [Tutorial] Poster home da GET /api/public-kiosk/home —",
            this.ads.length,
            "attività"
          );
          this.afterBannerAdsLoaded();
          return;
        }
        kioskDevLog(
          "📎 [Tutorial] Nessun poster eleggibile in /home — provo GET /api/public-kiosk/home-posters"
        );
        this.loadHomePostersFromApi();
      },
      error: () => {
        kioskDevWarn(
          "⚠️ [Tutorial] GET home KO — provo GET /api/public-kiosk/home-posters"
        );
        this.loadHomePostersFromApi();
      },
    });
  }

  /** Endpoint dedicato stesso payload dei poster (evita parsing di wrapper diversi). */
  private loadHomePostersFromApi(): void {
    this.kioskApi.getHomePosters().subscribe({
      next: (raw) => {
        const items = this.kioskApi.unwrapHomePostersItems(raw);
        const mapped = this.buildAdsFromBannerDtos(items);
        const ready = this.dedupeAndSortPosters(mapped);
        if (ready.length) {
          this.ads = ready;
          kioskDevLog(
            "✅ [Tutorial] Poster home da GET /api/public-kiosk/home-posters —",
            ready.length,
            "attività"
          );
          this.afterBannerAdsLoaded();
          return;
        }
        kioskDevWarn(
          "⚠️ [Tutorial] home-posters vuoto — provo GET /api/public-kiosk/businesses"
        );
        this.tryLoadPostersFromBusinesses();
      },
      error: () => {
        kioskDevWarn(
          "⚠️ [Tutorial] GET home-posters KO — provo lista attività"
        );
        this.tryLoadPostersFromBusinesses();
      },
    });
  }

  /**
   * Banner orizzontali promozionali: feed separato; non sostituisce mai i poster 4:5.
   * Se l’API fallisce, la home resta utilizzabile senza strip promo.
   */
  private loadPromoStrip(): void {
    if (!environment.useKioskPublicApi) {
      this.promoAds = [];
      this.stopPromoStripAuto();
      return;
    }
    this.kioskApi.getPromoBanners().subscribe({
      next: (raw) => {
        this.promoAds = this.buildPromoAdsFromPayload(raw);
        this.bumpAssetCacheVersion();
        kioskDevLog(
          "🖼️✅ [Tutorial] Promo banner orizzontali caricati —",
          this.promoAds.length,
          "elementi"
        );
        this.schedulePromoStripLayoutRefresh();
      },
      error: () => {
        kioskDevWarn(
          "⚠️ [Tutorial] GET promo-banners KO — strip promo disattivata (home ok)"
        );
        this.promoAds = [];
        this.stopPromoStripAuto();
      },
    });
  }

  private startFeedVersionPolling(): void {
    if (!environment.useKioskPublicApi) return;
    this.stopFeedVersionPolling();
    this.checkFeedVersionAndRefresh(true);
    this.feedVersionPollTimer = setInterval(() => {
      this.checkFeedVersionAndRefresh(false);
    }, this.FEED_VERSION_POLL_MS);
  }

  private stopFeedVersionPolling(): void {
    if (this.feedVersionPollTimer) {
      clearInterval(this.feedVersionPollTimer);
      this.feedVersionPollTimer = undefined;
    }
    this.feedVersionInFlight = false;
  }

  private checkFeedVersionAndRefresh(bootstrap: boolean): void {
    if (this.feedVersionInFlight) return;
    this.feedVersionInFlight = true;
    this.kioskApi
      .getFeedVersion()
      .pipe(take(1))
      .subscribe({
        next: (raw) => {
          this.feedVersionInFlight = false;
          const obj = (raw as Record<string, unknown> | null) ?? null;
          const version = String(
            (obj?.version as string | undefined) ??
              ((obj?.data as Record<string, unknown> | undefined)?.version as string | undefined) ??
              ""
          ).trim();
          if (!version) return;
          if (!this.lastFeedVersion) {
            this.lastFeedVersion = version;
            this.lastFeedHardRefreshAt = Date.now();
            if (bootstrap) {
              kioskDevLog("🛰️ [Tutorial] Feed version bootstrap:", version.slice(0, 18));
            }
            return;
          }
          if (version === this.lastFeedVersion) {
            const now = Date.now();
            if (now - this.lastFeedHardRefreshAt >= this.FEED_HARD_REFRESH_MS) {
              this.refreshPublicFeeds("hard-refresh");
            }
            return;
          }
          const prev = this.lastFeedVersion;
          this.lastFeedVersion = version;
          kioskDevLog(
            "🔄 [Tutorial] Feed version changed — refresh poster/promo",
            `${prev.slice(0, 8)} -> ${version.slice(0, 8)}`
          );
          this.refreshPublicFeeds("version-change");
        },
        error: () => {
          this.feedVersionInFlight = false;
        },
      });
  }

  private refreshPublicFeeds(reason: "version-change" | "hard-refresh"): void {
    this.lastFeedHardRefreshAt = Date.now();
    kioskDevLog("🧩 [Tutorial] Refresh feed pubblici:", reason);
    this.loadBannerCarousel();
    this.loadPromoStrip();
  }

  private resolveFeedVersionPollMs(): number {
    const raw = Number((environment as Record<string, unknown>)["kioskFeedVersionPollMs"]);
    if (!Number.isFinite(raw)) return 30_000;
    return Math.min(5 * 60_000, Math.max(5_000, Math.round(raw)));
  }

  private resolveFeedHardRefreshMs(): number {
    const rawMin = Number((environment as Record<string, unknown>)["kioskFeedHardRefreshMinutes"]);
    if (!Number.isFinite(rawMin)) return 10 * 60_000;
    const ms = Math.round(rawMin * 60_000);
    return Math.min(120 * 60_000, Math.max(60_000, ms));
  }

  /** Mappa risposta `/promo-banners` → item UI; blocca tap su CTA esterne (log 🔒). */
  private buildPromoAdsFromPayload(raw: unknown): PromoAdItem[] {
    const items = this.kioskApi.unwrapPromoBanners(raw);
    const out: PromoAdItem[] = [];
    for (const b of items) {
      const p = this.mapPromoBannerRow(b);
      if (p?.src) out.push(p);
    }
    return out;
  }

  private mapPromoBannerRow(b: KioskBannerDto): PromoAdItem | null {
    const o = b as Record<string, unknown>;
    const rawImg = String(
      b.image_url ?? b.imageUrl ?? b.src ?? ""
    ).trim();
    const src = rawImg ? this.kioskApi.resolveAssetUrl(rawImg) : "";
    const ctaVal = String(o.cta_value ?? b.cta_value ?? "").trim();
    const ctaType = String(o.cta_type ?? b.cta_type ?? "").toLowerCase();
    /** Priorità: sempre dettaglio attività interno se conosciamo lo slug business (regola prodotto poster/totem). */
    const businessSlug = String(
      o.business_slug ?? b.business_slug ?? b.businessSlug ?? b.slug ?? ""
    ).trim();
    let activitySlug: string | undefined = businessSlug || undefined;
    if (!activitySlug && ctaVal && !/^https?:\/\//i.test(ctaVal)) {
      if (
        ctaType === "business_detail" ||
        ctaType === "business" ||
        ctaType === "internal" ||
        ctaType === "speaker" ||
        !ctaType
      ) {
        activitySlug = ctaVal;
      }
    }
    /** Solo se non abbiamo alcuno slug interno e la CTA è un URL http(s), il tap non deve simulare un “browser”. */
    let blockedExternal = false;
    if (!activitySlug && /^https?:\/\//i.test(ctaVal)) {
      blockedExternal = true;
      kioskDevWarn(
        "🔒 [Tutorial] Promo: solo CTA esterna — nessuno slug attività, tap non naviga fuori dal totem —",
        ctaVal.slice(0, 72)
      );
    }
    if (!activitySlug && (ctaType === "external" || ctaType === "external_url")) {
      blockedExternal = true;
      kioskDevWarn("🔒 [Tutorial] Promo: tipo CTA esterno senza slug locale —", ctaType);
    }
    const bn = [b.businessName, b.business_name]
      .map((x) => (x == null ? "" : String(x).trim()))
      .find((s) => s.length > 0);
    const title = (b.title != null ? String(b.title).trim() : "") || undefined;
    const subtitle =
      (b.subtitle != null ? String(b.subtitle).trim() : "") || undefined;
    return {
      src: src || this.POSTER_PLACEHOLDER,
      title,
      subtitle,
      businessName: bn,
      activitySlug,
      blockedExternal,
    };
  }

  /**
   * Tap sulla strip “In evidenza”: prima anteprima a schermo intero; da lì si può aprire la scheda attività se c’è uno slug.
   * Caricamento card: `loadPromoStrip()` → GET `/api/public-kiosk/promo-banners` (se `environment.useKioskPublicApi`).
   */
  onPromoClick(p: PromoAdItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (p.blockedExternal) {
      kioskDevWarn("🔒 [Tutorial] Tap promo — CTA esterna; solo anteprima, nessuna navigazione");
      void this.toastCtrl
        .create({
          message: "Anteprima banner. Questo messaggio non è collegato a una scheda attività sul totem.",
          duration: 2600,
          position: "bottom",
          color: "medium",
        })
        .then((t) => t.present());
    }
    this.openPromoFullscreen(p);
  }

  openPromoFullscreen(p: PromoAdItem): void {
    this.promoFullscreenItem = p;
    this.promoFullscreenOpen = true;
  }

  closePromoFullscreen(ev?: Event, source: string = "unknown"): void {
    ev?.stopPropagation();
    if (!this.promoFullscreenOpen) return;
    this.promoFullscreenOpen = false;
    this.promoFullscreenItem = null;
  }

  /** Slug sicuro per il pulsante “Scheda attività” (dettaglio interno). */
  get promoFullscreenNavSlug(): string | null {
    const p = this.promoFullscreenItem;
    if (!p || p.blockedExternal) return null;
    return safeKioskBusinessSlug(p.activitySlug);
  }

  get posterFullscreenNavSlug(): string | null {
    const p = this.posterFullscreenItem;
    if (!p) return null;
    return normalizeKioskBusinessSlugCandidate(p.activitySlug);
  }

  /** True mentre il totem mostra il carosello poster fullscreen per inattività. */
  isIdlePosterMode(): boolean {
    return this.idlePosterMode;
  }

  openPosterFullscreen(ad: AdItem): void {
    this.posterFullscreenItem = ad;
    this.posterFullscreenOpen = true;
  }

  /** Tap/click sullo stage in modalità idle → esci dal saver (Windows totem / touch). */
  onPosterFullscreenShellClick(ev: Event): void {
    if (!this.idlePosterMode) return;
    this.closePosterFullscreen(ev);
  }

  closePosterFullscreen(ev?: Event): void {
    ev?.stopPropagation();
    this.pauseAllAdVideos(true);
    if (this.idlePosterMode) {
      this.exitIdlePosterMode();
    }
    if (!this.posterFullscreenOpen) return;
    this.posterFullscreenOpen = false;
    this.posterFullscreenItem = null;
  }

  onFullscreenTouchStart(ev: TouchEvent): void {
    const t = ev.changedTouches?.[0];
    if (!t) return;
    this.fullscreenSwipeStartX = t.clientX;
    this.fullscreenSwipeStartY = t.clientY;
  }

  onPosterFullscreenTouchEnd(ev: TouchEvent): void {
    const step = this.consumeFullscreenSwipeStep(ev);
    if (!step) {
      if (this.idlePosterMode) this.closePosterFullscreen(ev);
      return;
    }
    this.stepPosterFullscreen(step);
  }

  onPromoFullscreenTouchEnd(ev: TouchEvent): void {
    const step = this.consumeFullscreenSwipeStep(ev);
    if (!step) return;
    this.stepPromoFullscreen(step);
  }

  private consumeFullscreenSwipeStep(ev: TouchEvent): -1 | 0 | 1 {
    const sx = this.fullscreenSwipeStartX;
    const sy = this.fullscreenSwipeStartY;
    this.fullscreenSwipeStartX = null;
    this.fullscreenSwipeStartY = null;
    const t = ev.changedTouches?.[0];
    if (!t || sx == null || sy == null) return 0;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) < this.FULLSCREEN_SWIPE_THRESHOLD_PX) return 0;
    if (Math.abs(dy) > this.FULLSCREEN_SWIPE_MAX_OFF_AXIS_PX && Math.abs(dy) > Math.abs(dx)) return 0;
    return dx < 0 ? 1 : -1;
  }

  private stepPosterFullscreen(step: -1 | 1): void {
    if (!this.posterFullscreenOpen || !this.posterFullscreenItem || !this.ads.length) return;
    const imageIndices: number[] = [];
    for (let i = 0; i < this.ads.length; i++) {
      if (this.ads[i]?.kind === "image") imageIndices.push(i);
    }
    if (!imageIndices.length) return;

    let currentPos = imageIndices.findIndex((idx) => this.ads[idx] === this.posterFullscreenItem);
    if (currentPos < 0) {
      currentPos = imageIndices.findIndex((idx) => this.ads[idx]?.src === this.posterFullscreenItem?.src);
    }
    if (currentPos < 0) currentPos = 0;

    const nextPos = (currentPos + step + imageIndices.length) % imageIndices.length;
    const nextAdsIndex = imageIndices[nextPos];
    this.adsIndex = nextAdsIndex;
    this.goToAd(nextAdsIndex, "smooth");
    this.posterFullscreenItem = this.ads[nextAdsIndex];
  }

  private stepPromoFullscreen(step: -1 | 1): void {
    if (!this.promoFullscreenOpen || !this.promoFullscreenItem || !this.promoAds.length) return;
    let idx = this.promoAds.findIndex((p) => p === this.promoFullscreenItem);
    if (idx < 0) idx = this.promoAds.findIndex((p) => p.src === this.promoFullscreenItem?.src);
    if (idx < 0) idx = 0;
    const next = (idx + step + this.promoAds.length) % this.promoAds.length;
    this.promoFullscreenItem = this.promoAds[next];
    this.promoStripActiveIndex = next;
    this.scrollPromoToIndex(next, "smooth");
  }

  private scheduleIdlePosterMode(): void {
    if (!this.idlePosterEnabled) return;
    this.clearIdlePosterTimers();
    this.idlePosterTimer = setTimeout(() => this.enterIdlePosterMode(), this.idlePosterTimeoutMs);
  }

  private clearIdlePosterTimers(): void {
    if (this.idlePosterTimer) {
      clearTimeout(this.idlePosterTimer);
      this.idlePosterTimer = undefined;
    }
    if (this.idlePosterRotateTimer) {
      clearInterval(this.idlePosterRotateTimer);
      this.idlePosterRotateTimer = undefined;
    }
  }

  private onTutorialInteraction(): void {
    if (this.idlePosterMode) {
      this.exitIdlePosterMode();
    }
    this.scheduleIdlePosterMode();
  }

  private firstImageAdIndex(startIndex = this.adsIndex): number {
    if (!this.ads.length) return -1;
    for (let offset = 0; offset < this.ads.length; offset++) {
      const i = (startIndex + offset) % this.ads.length;
      const ad = this.ads[i];
      if (ad?.kind === "image" || ad?.kind === "video") return i;
    }
    return -1;
  }

  private enterIdlePosterMode(): void {
    if (!this.idlePosterEnabled) return;
    if (this.idlePosterMode || !this.ads.length) return;
    const firstPosterIndex = this.firstImageAdIndex(this.adsIndex);
    if (firstPosterIndex < 0) return;

    this.idlePosterMode = true;
    this.stopAdsCarousel();
    this.clearVideoAdAdvance();
    this.pauseAllAdVideos(false);
    this.goToAd(firstPosterIndex, "auto");
    this.openPosterFullscreen(this.ads[firstPosterIndex]);

    this.idlePosterRotateTimer = setInterval(() => {
      const nextPosterIndex = this.firstImageAdIndex(this.adsIndex + 1);
      if (nextPosterIndex < 0) return;
      this.goToAd(nextPosterIndex, "auto");
      this.posterFullscreenItem = this.ads[nextPosterIndex];
    }, this.idlePosterRotationMs);
  }

  private loadIdlePosterRuntimeConfig(): void {
    if (!(environment as Record<string, unknown>)["useKioskPublicApi"]) return;
    this.kioskApi.getHome().pipe(take(1)).subscribe({
      next: (raw) => {
        const cfg = this.kioskApi.unwrapIdleFullscreenConfig(raw);
        this.idlePosterEnabled = cfg.enabled;
        this.idlePosterTimeoutMs = cfg.timeoutMs;
        this.idlePosterRotationMs = cfg.rotationMs;
        kioskDevLog("⚙️ [Tutorial] Inattività runtime:", {
          enabled: this.idlePosterEnabled,
          timeoutMs: this.idlePosterTimeoutMs,
          rotationMs: this.idlePosterRotationMs,
        });
        if (!this.idlePosterEnabled) this.clearIdlePosterTimers();
      },
      error: () => {},
    });
  }

  private exitIdlePosterMode(): void {
    this.idlePosterMode = false;
    this.clearIdlePosterTimers();
    if (this.posterFullscreenOpen) {
      this.posterFullscreenOpen = false;
      this.posterFullscreenItem = null;
    }
    this.startAdsCarousel();
  }

  /**
   * Evita overlay fullscreen "appeso" durante cambio route:
   * chiude modal + aspetta almeno un frame prima della navigate.
   */
  private async flushFullscreenBeforeNavigate(): Promise<void> {
    if (this.posterFullscreenOpen) this.closePosterFullscreen();
    if (this.promoFullscreenOpen) this.closePromoFullscreen(undefined, "pre-nav");
    this.cdr.detectChanges();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  async goPosterDetailFromFullscreen(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault?.();
    const slug = this.posterFullscreenNavSlug;
    await this.flushFullscreenBeforeNavigate();
    if (!slug) {
      void this.toastCtrl
        .create({
          message: "Questo poster non ha una scheda attivita' disponibile.",
          duration: 1800,
          position: "bottom",
          color: "medium",
        })
        .then((t) => t.present());
      return;
    }
    await this.router
      .navigate(["/app/tabs/speakers/speaker-details", slug], {
        replaceUrl: false,
      })
      .catch(() => {});
  }

  /** Chiudi modal promo → opzionale navigazione alla scheda attività. */
  async goPromoDetailFromFullscreen(ev?: Event, source: string = "unknown"): Promise<void> {
    ev?.stopPropagation();
    ev?.preventDefault?.();
    const slug = this.promoFullscreenNavSlug;
    await this.flushFullscreenBeforeNavigate();
    if (!slug) {
      void this.toastCtrl
        .create({
          message: "Questa promo non ha una scheda attivita' disponibile.",
          duration: 1800,
          position: "bottom",
          color: "medium",
        })
        .then((t) => t.present());
      return;
    }
    const currentUrl = this.router.url;
    if (currentUrl.endsWith(`/app/tabs/speakers/speaker-details/${slug}`)) {
      void this.toastCtrl
        .create({
          message: "Sei gia' sulla scheda attivita'.",
          duration: 1600,
          position: "bottom",
          color: "medium",
        })
        .then((t) => t.present());
      return;
    }
    kioskDevLog("🧭 [Tutorial] Promo fullscreen → dettaglio attività — slug:", slug);
    await this.router
      .navigate(["/app/tabs/speakers/speaker-details", slug], { replaceUrl: false })
      .catch(() => {});
  }

  /** Seconda chance: costruisce 1 poster per ogni business (cover → logo → avatar). */
  private tryLoadPostersFromBusinesses(): void {
    this.kioskApi.getBusinesses().subscribe({
      next: (raw) => {
        const built = this.buildAdsFromBusinessesPayload(raw);
        const ready = this.dedupeAndSortPosters(built);
        if (ready.length) {
          this.ads = ready;
          kioskDevLog(
            "✅ [Tutorial] Poster home da GET /api/public-kiosk/businesses —",
            this.ads.length,
            "attività"
          );
          this.afterBannerAdsLoaded();
          return;
        }
        kioskDevWarn("⚠️ [Tutorial] Anche businesses vuoto — fallback JSON locale");
        this.loadFallbackBannersJson();
      },
      error: () => {
        kioskDevWarn("⚠️ [Tutorial] GET businesses KO — fallback JSON locale");
        this.loadFallbackBannersJson();
      },
    });
  }

  /**
   * JSON locale: carosello solo da `data.json` → speakers premium. Immagine carosello:
   * `logo` (banner/logotipo) → `coverUrl` → `posterUrl` → prima `foto` → avatar.
   */
  private loadFallbackBannersJson(): void {
    this.confService
      .load()
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          const built = this.buildAdsFromLocalJsonSpeakers(data.speakers ?? []);
          const ready = this.dedupeAndSortPosters(
            built.length ? built : this.minimalBannerFallback()
          );
          this.ads = ready;
          if (!built.length) {
            kioskDevWarn(
              "⚠️ [Tutorial] Nessun speaker premium in data.json — poster minimo o carosello vuoto dopo dedup"
            );
          } else {
            kioskDevLog(
              "📁 [Tutorial] Poster home da data.json (solo premium) —",
              ready.length,
              "attività"
            );
          }
          this.afterBannerAdsLoaded();
        },
        error: () => {
          this.ads = this.dedupeAndSortPosters(this.minimalBannerFallback());
          kioskDevWarn(
            "⚠️ [Tutorial] data.json non caricato — poster minimo con slug di esempio"
          );
          this.afterBannerAdsLoaded();
        },
      });
  }

  /** Allineato a `KioskApiService.isPremiumTotemBusiness` per oggetti `Speaker` da JSON. */
  private isPremiumLocalSpeaker(s: Speaker): boolean {
    if (s.isPremium === true) return true;
    const t = String(s.listingTier ?? (s as { listing_tier?: string }).listing_tier ?? "")
      .trim()
      .toLowerCase();
    return t === "premium";
  }

  private buildAdsFromLocalJsonSpeakers(speakers: Speaker[]): AdItem[] {
    const out: AdItem[] = [];
    for (const s of speakers) {
      if (!this.isPremiumLocalSpeaker(s)) continue;
      const slug = String(s.slug ?? "").trim();
      if (!slug) {
        kioskDevWarn(
          "⚠️ [Tutorial] Speaker premium senza slug — escluso dal carosello:",
          s.name || s.id
        );
        continue;
      }
      const fotos = Array.isArray(s.foto)
        ? s.foto
        : s.foto
          ? [String(s.foto)]
          : [];
      /* Carosello poster home: prima il “logo” banner (JSON `logo`), poi poster promozionale */
      const rawImg =
        (s.logo && String(s.logo).trim()) ||
        (s.coverUrl && String(s.coverUrl).trim()) ||
        s.posterUrl ||
        fotos[0] ||
        s.profilePic ||
        "";
      const resolved = rawImg
        ? this.kioskApi.resolveAssetUrl(String(rawImg))
        : "";
      out.push({
        kind: "image",
        src: resolved || this.POSTER_PLACEHOLDER,
        activitySlug: slug,
        businessName: s.name?.trim() || undefined,
        uploadedBy: undefined,
      });
    }
    return out;
  }

  private minimalBannerFallback(): AdItem[] {
    return [
      {
        kind: "image",
        src: "assets/img/speakers/agos_banner.png",
        activitySlug: "agos",
      },
    ];
  }

  private buildAdsFromBannerPayload(raw: unknown): AdItem[] {
    return this.buildAdsFromBannerDtos(this.kioskApi.unwrapBanners(raw));
  }

  /** Filtra per regole kiosk (approvazioni + attivo + solo premium), poi mappa in AdItem. */
  private buildAdsFromBannerDtos(items: KioskBannerDto[]): AdItem[] {
    const eligible = items.filter((b) => this.kioskApi.isEligibleKioskHomePoster(b));
    const premium = eligible.filter((b) => this.kioskApi.isPremiumKioskHomePoster(b));
    if (eligible.length && !premium.length) {
      kioskDevInfo(
        "⭐ [Tutorial] Poster home: nessuna attività premium tra i candidati — carosello vuoto (solo listing premium)."
      );
    }
    return premium
      .map((b) => this.mapBannerDtoToPoster(b))
      .filter((x): x is AdItem => !!x);
  }

  private buildAdsFromBusinessesPayload(raw: unknown): AdItem[] {
    const list = this.kioskApi
      .filterPublishedForKiosk(this.kioskApi.unwrapBusinessList(raw))
      .filter((dto) => this.kioskApi.isPremiumTotemBusiness(dto));
    const out: AdItem[] = [];
    for (const dto of list) {
      const slug = this.extractSlugFromBusiness(dto);
      if (!slug) {
        kioskDevWarn(
          "⚠️ [Tutorial] Attività senza slug/id — poster home escluso:",
          dto.name || "(senza nome)"
        );
        continue;
      }
      const rawImg =
        dto.cover ||
        dto.coverUrl ||
        dto.logo ||
        dto.logoUrl ||
        dto.profilePic ||
        dto.avatarUrl;
      const resolved = rawImg
        ? this.kioskApi.resolveAssetUrl(rawImg as string)
        : "";
      out.push({
        kind: "image",
        src: resolved || this.POSTER_PLACEHOLDER,
        activitySlug: slug,
      });
    }
    return out;
  }

  private extractSlugFromBusiness(dto: KioskPublicBusinessDto): string {
    const s = dto.slug ?? dto.id;
    return s != null ? String(s).trim() : "";
  }

  /**
   * Un solo poster per chiave attività; ordinamento alfabetico sullo slug per stabilità tra refresh.
   */
  private dedupeAndSortPosters(items: AdItem[]): AdItem[] {
    const map = new Map<string, AdItem>();
    for (const it of items) {
      const key = this.posterDedupeKey(it);
      if (!key) {
        kioskDevWarn("⚠️ [Tutorial] Slide poster senza chiave dedup — ignorata", it.src);
        continue;
      }
      if (map.has(key)) {
        kioskDevWarn(
          "⚠️ [Tutorial] Poster duplicato per la stessa attività — uso il primo:",
          key
        );
        continue;
      }
      map.set(key, it);
    }
    return [...map.values()].sort((a, b) =>
      this.posterSortKey(a).localeCompare(this.posterSortKey(b), "it")
    );
  }

  private posterDedupeKey(it: AdItem): string {
    const slug = it.activitySlug?.trim();
    if (slug) {
      if (it.multiHomePosters) {
        const src = String(it.src || "").trim();
        const title = String(it.title || "").trim();
        const subtitle = String(it.subtitle || "").trim();
        return `slug-multi:${slug}:${src}:${title}:${subtitle}`;
      }
      return `slug:${slug}`;
    }
    if (it.src?.trim()) return `src:${it.src.trim()}`;
    return "";
  }

  private posterSortKey(it: AdItem): string {
    return it.activitySlug || it.src || "";
  }

  private mapBannerDtoToPoster(b: KioskBannerDto): AdItem | null {
    const mtRaw = String(b.mediaType || b.media_type || b.poster_media_type || "").toLowerCase();
    const mimeRaw = String(b.mime_type || b.mimeType || "").toLowerCase();
    const o = b as Record<string, unknown>;
    const mediaPublic = String(
      b.public_url ?? o.media_public_url ?? b.video_url ?? b.media_url ?? ""
    ).trim();
    const isVideo =
      mtRaw === "video" ||
      mimeRaw.startsWith("video/") ||
      this.kioskApi.isLikelyVideoAssetUrl(mediaPublic) ||
      this.kioskApi.isLikelyVideoAssetUrl(b.homePosterUrl) ||
      this.kioskApi.isLikelyVideoAssetUrl(b.posterUrl) ||
      this.kioskApi.isLikelyVideoAssetUrl(b.image_url) ||
      this.kioskApi.isLikelyVideoAssetUrl(b.imageUrl);
    const ext = b.externalUrl || b.linkUrl;
    if (ext && String(ext).trim().match(/^https?:\/\//i)) {
      kioskDevWarn(
        "🔒 [Tutorial] URL esterno su banner ignorato (home kiosk solo navigazione interna):",
        ext
      );
    }
    const slug = this.extractActivitySlugFromBanner(b);
    const nested = b.poster;
    const rawVideoSrc =
      b.video_url ||
      b.media_url ||
      mediaPublic ||
      (isVideo
        ? b.homePosterUrl || b.posterUrl || b.public_url || b.image_url || b.imageUrl
        : null);
    const rawImageSrc =
      b.homePosterUrl ||
      b.posterUrl ||
      b.imageUrl ||
      nested?.imageUrl ||
      nested?.image_url ||
      b.image_url ||
      b.src ||
      b.url;
    const hasVideoSrc = isVideo && !!String(rawVideoSrc || "").trim();
    const effectiveVideo = hasVideoSrc;
    const rawSrc = effectiveVideo ? String(rawVideoSrc) : rawImageSrc;
    const resolved = rawSrc ? this.kioskApi.resolveAssetUrl(String(rawSrc)) : "";
    const rawThumb =
      b.poster_thumb_url ||
      b.posterThumbUrl ||
      b.poster ||
      "";
    const resolvedPoster = rawThumb ? this.kioskApi.resolveAssetUrl(String(rawThumb)) : undefined;
    const fallbackRaw =
      b.business_cover_url ||
      b.business_logo_url ||
      "";
    const fallbackResolved = fallbackRaw
      ? this.kioskApi.resolveAssetUrl(String(fallbackRaw))
      : "";
    const bn = [b.businessName, b.business_name]
      .map((x) => (x == null ? "" : String(x).trim()))
      .find((s) => s.length > 0);
    const title = (b.title != null ? String(b.title).trim() : "") || undefined;
    const subtitle =
      (b.subtitle != null ? String(b.subtitle).trim() : "") || undefined;
    const multiHomePosters =
      b.multi_home_posters === true ||
      b.multi_home_posters === 1 ||
      b.multiHomePosters === true ||
      b.multiHomePosters === 1;
    const uploadedBy =
      String(b.uploadedBy ?? "").trim() ||
      (String(b.uploaded_by_type ?? "").toLowerCase() === "admin"
        ? "admin"
        : String(b.uploaded_by_email ?? "").trim()) ||
      undefined;
    return {
      kind: effectiveVideo ? "video" : "image",
      src: resolved || this.POSTER_PLACEHOLDER,
      poster: effectiveVideo ? resolvedPoster : undefined,
      fallbackSrc: fallbackResolved || undefined,
      activitySlug: slug || undefined,
      businessName: bn,
      title,
      subtitle,
      uploadedBy,
      multiHomePosters,
    };
  }

  private extractActivitySlugFromBanner(b: KioskBannerDto): string {
    const o = b as Record<string, unknown>;
    const targetType = String(
      b.target_type ?? o.target_type ?? o.targetType ?? ""
    ).toLowerCase();
    const targetVal = String(
      b.target_value ?? o.target_value ?? o.targetValue ?? ""
    ).trim();
    if (targetVal && (targetType === "business_detail" || targetType === "speaker" || targetType === "")) {
      const normalized = normalizeKioskBusinessSlugCandidate(targetVal);
      if (normalized) return normalized;
    }

    const ctaType = String(b.cta_type ?? o.cta_type ?? "").toLowerCase();
    const ctaVal = String(b.cta_value ?? o.cta_value ?? "").trim();
    if (ctaVal && (ctaType === "business_detail" || ctaType === "business" || ctaType === "internal")) {
      const normalized = normalizeKioskBusinessSlugCandidate(ctaVal);
      if (normalized) return normalized;
    }

    const x = b as KioskBannerDto & { activitySlug?: string };
    const cand =
      x.business_slug ||
      x.businessSlug ||
      x.activitySlug ||
      b.slug ||
      b.speakerId ||
      (b.id != null ? String(b.id) : "");
    return normalizeKioskBusinessSlugCandidate(String(cand || "").trim()) || "";
  }

  /** Dopo aver impostato `ads`: riallinea indici video e avvia carosello */
  private afterBannerAdsLoaded(): void {
    this.bumpAssetCacheVersion();
    this.rebuildVideoAdIndexes();
    const resumeIdleFullscreen =
      this.idlePosterMode && this.posterFullscreenOpen;
    setTimeout(() => {
      if (!this.ads.length) return;
      if (resumeIdleFullscreen) {
        this.syncPosterFullscreenFromAds();
        this.bindAdVideoObserver();
        return;
      }
      if (this.posterFullscreenOpen) {
        this.syncPosterFullscreenFromAds();
      }
      this.goToAd(this.adsIndex, "auto");
      this.startAdsCarousel();
      this.bindAdVideoObserver();
      if (this.forceIdlePosterOnNextAdsLoad) {
        this.forceIdlePosterOnNextAdsLoad = false;
        this.enterIdlePosterMode();
      }
    }, 0);
  }

  /**
   * Dopo refresh feed (polling feed-version): aggiorna l’overlay fullscreen
   * senza reload pagina — match per slug attività, fallback su src precedente.
   */
  private syncPosterFullscreenFromAds(): void {
    if (!this.posterFullscreenOpen || !this.posterFullscreenItem || !this.ads.length) {
      return;
    }
    const prev = this.posterFullscreenItem;
    const prevSlug = normalizeKioskBusinessSlugCandidate(prev.activitySlug);
    let idx = prevSlug
      ? this.ads.findIndex(
          (a) => normalizeKioskBusinessSlugCandidate(a.activitySlug) === prevSlug
        )
      : -1;
    if (idx < 0 && prev.src) {
      const prevBase = prev.src.split("?")[0];
      idx = this.ads.findIndex((a) => a.src.split("?")[0] === prevBase);
    }
    if (idx < 0) {
      idx = this.firstImageAdIndex(this.adsIndex);
    }
    if (idx < 0) return;
    this.adsIndex = idx;
    this.posterFullscreenItem = this.ads[idx];
    this.goToAd(idx, "auto");
  }

  // ========= CAROSELLO POSTER / VIDEO =========
  startAdsCarousel() {
    if (!this.ads.length) return;
    this.stopAdsCarousel();
    this.adsTimer = setInterval(() => {
      if (this.adsUserPause) return;
      const current = this.ads[this.adsIndex];
      if (current?.kind === "video" && !this.isClickToPlayVideo(this.adsIndex)) return;
      const next = (this.adsIndex + 1) % this.ads.length;
      this.goToAd(next);
    }, this.ADS_DURATION_MS);
  }

  /** Appende query `v` alle immagini per evitare cache stale su URL invariata. */
  assetUrl(url: string | null | undefined): string {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^(data:|blob:)/i.test(raw)) return raw;
    const sep = raw.includes("?") ? "&" : "?";
    return `${raw}${sep}v=${this.assetCacheVersion}`;
  }

  private bumpAssetCacheVersion(): void {
    this.assetCacheVersion = Date.now();
  }

  stopAdsCarousel() {
    if (this.adsTimer) {
      clearInterval(this.adsTimer);
      this.adsTimer = undefined;
    }
  }

  /**
   * Dopo GET promo: il `#promoStrip` è dentro *ngIf — serve un ciclo di change detection + layout
   * prima di scroll/timer (altrimenti ViewChild e offsetWidth sono inconsistenti).
   */
  private schedulePromoStripLayoutRefresh(): void {
    this.stopPromoStripAuto();
    this.promoAutoIndex = 0;
    this.promoStripActiveIndex = 0;
    this.cdr.detectChanges();
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this.promoAds?.length) return;
          this.scrollPromoToIndex(0, "auto");
          this.startPromoStripAuto();
        });
      });
    });
  }

  /** Scroll orizzontale automatico sulla strip “In evidenza” (2+ card). */
  private startPromoStripAuto(): void {
    this.stopPromoStripAuto();
    if (!this.promoAds?.length || this.promoAds.length < 2) return;
    this.promoAutoTimer = setInterval(() => {
      if (this.promoFullscreenOpen) return;
      if (Date.now() < this.promoStripPauseUntil) return;
      this.promoAutoIndex = (this.promoAutoIndex + 1) % this.promoAds.length;
      this.scrollPromoToIndex(this.promoAutoIndex, "smooth");
    }, this.ADS_DURATION_MS);
  }

  private stopPromoStripAuto(): void {
    if (this.promoAutoTimer) {
      clearInterval(this.promoAutoTimer);
      this.promoAutoTimer = undefined;
    }
  }

  /** Centra la card nella viewport orizzontale della strip (più affidabile di scrollIntoView nel flex overflow). */
  private scrollPromoToIndex(i: number, behavior: ScrollBehavior = "smooth"): void {
    const strip = this.promoStripRef?.nativeElement;
    if (!strip) return;
    const cards = strip.querySelectorAll("button.kiosk-promo-card");
    const el = cards[i] as HTMLElement | undefined;
    if (!el) return;
    const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const ideal =
      el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({
      left: Math.max(0, Math.min(maxScroll, ideal)),
      behavior,
    });
    this.promoStripActiveIndex = i;
  }

  /** Tap sui dots “In evidenza” (stesso schema del poster). */
  goToPromoStripIndex(i: number): void {
    if (i < 0 || !this.promoAds?.length || i >= this.promoAds.length) return;
    this.promoAutoIndex = i;
    this.onPromoStripInteraction();
    this.scrollPromoToIndex(i, "smooth");
  }

  /** Pausa breve auto-scroll dopo tocco / scroll manuale sulla strip. */
  onPromoStripInteraction(): void {
    this.promoStripPauseUntil = Date.now() + 6_000;
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
      v.volume = 0;
      v.setAttribute("muted", "");
      if (resetTime) v.currentTime = 0;
    } catch {}
  }

  /** Ferma il video associato a un indice slide (enterprise: sempre al cambio slide). */
  private stopVideoAtAdIndex(adIndex: number, resetTime = true) {
    const v = this.getVideoElByAdIndex(adIndex);
    if (v) this.stopAndMuteVideoEl(v, resetTime);
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
    if (currentIsVideo && !this.isClickToPlayVideo(currentAdIndex))
      this.ensureAdVideoPlaying(currentAdIndex);
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
            if (!this.isClickToPlayVideo(adIndex)) this.ensureAdVideoPlaying(adIndex);
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

    // proprietà + attributi richiesti su iOS / Windows kiosk
    (v as any).playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "true");
    v.autoplay = true;
    v.loop = false;

    const wantAudio = this.adsAudioWanted && adIndex === this.adsIndex;
    this.adsShowUnmuteBtn = wantAudio && this.adsMuted && this.isCurrentAdVideo;

    const tryPlay = (tries = 6, startMuted = true) => {
      try {
        v.muted = startMuted;
        if (startMuted) v.setAttribute("muted", "");
        else {
          v.removeAttribute("muted");
          v.volume = 1;
        }
        v.load();
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            if (adIndex !== this.adsIndex) {
              this.stopAndMuteVideoEl(v, false);
              return;
            }
            if (wantAudio && startMuted) {
              void this.tryUnmuteAd(adIndex);
            } else if (wantAudio && !startMuted) {
              this.adsMuted = false;
              this.adsShowUnmuteBtn = false;
            } else {
              this.adsMuted = true;
              v.muted = true;
              v.setAttribute("muted", "");
            }
          }).catch(() => {
            if (wantAudio && startMuted && tries > 0) {
              setTimeout(() => tryPlay(tries - 1, true), 300);
            } else if (tries > 0) {
              setTimeout(() => tryPlay(tries - 1, true), 300);
            } else {
              this.adsMuted = true;
              this.adsShowUnmuteBtn = wantAudio && this.isCurrentAdVideo;
            }
          });
        }
      } catch {
        if (tries > 0) setTimeout(() => tryPlay(tries - 1, true), 300);
        else {
          this.adsMuted = true;
          this.adsShowUnmuteBtn = wantAudio && this.isCurrentAdVideo;
        }
      }
    };

    const once = (ev: keyof HTMLVideoElementEventMap, fn: () => void) => {
      const h = () => {
        v.removeEventListener(ev, h as any);
        fn();
      };
      v.addEventListener(ev, h as any, { once: true });
    };
    once("loadeddata", () => tryPlay(4, true));
    once("canplaythrough", () => tryPlay(4, true));

    tryPlay(6, true);
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

  private leaveVideoAd(prevAdIndex?: number) {
    this.clearVideoAdAdvance();
    const idx = typeof prevAdIndex === "number" ? prevAdIndex : this.adsIndex;
    this.stopVideoAtAdIndex(idx, true);
  }

  private clearVideoAdAdvance() {
    if (this.videoAdAdvanceTimer) {
      clearTimeout(this.videoAdAdvanceTimer);
      this.videoAdAdvanceTimer = undefined;
    }
  }

  /** Handler template: audio su video fullscreen (non idle). */
  onPosterFullscreenVideoReady(): void {
    if (this.isIdlePosterMode() || !this.adsAudioWanted) return;
    void this.tryUnmuteAd(this.adsIndex);
  }

  private async tryUnmuteAd(adIndex: number) {
    if (adIndex !== this.adsIndex) return;
    if (!this.adsAudioWanted) return;
    if (!this.adsAudioUnlocked && !this.isTotemKiosk) return;

    const v = this.getVideoElByAdIndex(adIndex);
    if (!v) return;

    try {
      v.muted = false;
      v.removeAttribute("muted");
      v.volume = 1;
      await v.play();
      this.adsMuted = false;
      this.adsShowUnmuteBtn = false;
    } catch {
      v.muted = true;
      v.setAttribute("muted", "");
      this.adsMuted = true;
      this.adsShowUnmuteBtn = this.isCurrentAdVideo;
    }
  }

  goToAd(i: number, behavior: ScrollBehavior = "smooth") {
    if (!this.ads.length) return;
    const prevIndex = this.adsIndex;
    const prev = this.ads[prevIndex];
    if (prev?.kind === "video") this.leaveVideoAd(prevIndex);
    if (this.isClickToPlayVideo(prevIndex)) {
      this.clearAdsPlayBtnTimer();
      this.adsShowPlayBtn = false;
    }

    this.adsIndex = Math.max(0, Math.min(i, this.ads.length - 1));
    const track = this.adsTrack?.nativeElement;
    if (!track) return;
    const x = this.adsIndex * track.clientWidth;
    track.scrollTo({ left: x, behavior });

    const current = this.ads[this.adsIndex];
    this.pauseAllAdVideos(false);
    if (current?.kind === "video") {
      if (this.isClickToPlayVideo(this.adsIndex)) {
        this.clearAdsPlayBtnTimer();
        this.adsShowPlayBtn = true;
        this.adsPlayBtnHideTimer = setTimeout(() => {
          this.adsShowPlayBtn = false;
        }, 5_000);
        this.startAdsCarousel();
      } else {
        this.enterVideoAd(this.adsIndex);
      }
    } else {
      this.startAdsCarousel();
    }

    // allineo stato video: solo quello di turno può riprodurre / avere audio
    this.syncAdVideos();

    this.adsShowUnmuteBtn = this.isCurrentAdVideo && this.adsMuted && this.adsAudioWanted;
    this.preloadAdjacentPosters();
  }

  onAdsScroll() {
    const track = this.adsTrack?.nativeElement;
    if (!track || !this.ads.length) return;
    const w = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== this.adsIndex) {
      const prevIndex = this.adsIndex;
      const prev = this.ads[prevIndex];
      if (prev?.kind === "video") this.leaveVideoAd(prevIndex);
      if (this.isClickToPlayVideo(prevIndex)) {
        this.clearAdsPlayBtnTimer();
        this.adsShowPlayBtn = false;
      }

      this.adsIndex = idx;
      this.pauseAllAdVideos(false);

      const current = this.ads[this.adsIndex];
      if (current?.kind === "video") {
        if (this.isClickToPlayVideo(this.adsIndex)) {
          this.clearAdsPlayBtnTimer();
          this.adsShowPlayBtn = true;
          this.adsPlayBtnHideTimer = setTimeout(() => {
            this.adsShowPlayBtn = false;
          }, 5_000);
          this.startAdsCarousel();
        } else {
          this.enterVideoAd(this.adsIndex);
        }
      } else {
        this.startAdsCarousel();
      }

      this.syncAdVideos();
      this.adsShowUnmuteBtn = this.isCurrentAdVideo && this.adsMuted && this.adsAudioWanted;
      this.preloadAdjacentPosters();
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
    if (current?.kind === "video") {
      if (this.isClickToPlayVideo(this.adsIndex)) {
        this.clearAdsPlayBtnTimer();
        this.adsShowPlayBtn = true;
        this.adsPlayBtnHideTimer = setTimeout(() => {
          this.adsShowPlayBtn = false;
        }, 5_000);
        this.startAdsCarousel();
      } else {
        this.enterVideoAd(this.adsIndex);
      }
    } else {
      this.startAdsCarousel();
    }
  }

  removeBrokenAd(i: number) {
    const missing = this.ads[i]?.src;
    kioskDevWarn("[Carosello] Media mancante: rimuovo", missing);

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
    if (i !== this.adsIndex) return;
    this.clearVideoAdAdvance();
    this.stopVideoAtAdIndex(i, true);
    this.goToAd((i + 1) % this.ads.length);
  }

  // CTA audio carosello
  /** True per i due video "play su tap"; usano lo stesso timer dei poster se non si preme Play */
  isClickToPlayVideo(adIndex: number): boolean {
    const ad = this.ads[adIndex];
    return !!ad && ad.kind === "video" && this.CLICK_TO_PLAY_VIDEO_SRCS.some((s) => ad.src.includes(s));
  }

  /** Chiamato dal bottone Play sui video click-to-play: avvia video e timer di avanzamento a fine */
  playClickToPlayAd(): void {
    if (!this.isClickToPlayVideo(this.adsIndex)) return;
    this.clearAdsPlayBtnTimer();
    this.adsShowPlayBtn = false;
    this.enterVideoAd(this.adsIndex);
  }

  private clearAdsPlayBtnTimer(): void {
    if (this.adsPlayBtnHideTimer) {
      clearTimeout(this.adsPlayBtnHideTimer);
      this.adsPlayBtnHideTimer = undefined;
    }
  }

  get isCurrentAdVideo(): boolean {
    return this.ads[this.adsIndex]?.kind === "video";
  }

  get showAdsAudioCta(): boolean {
    return this.isCurrentAdVideo && this.adsMuted && this.adsAudioWanted;
  }

  toggleAdsAudio() {
    this.adsAudioWanted = true;
    this.adsAudioWantedManual = true;
    this.adsAudioUnlocked = true;
    this.tryUnmuteAd(this.adsIndex);
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

  /** Seconda riga sotto il nome: mostra solo se non duplica il nome attività (mobile: leggibilità). */
  showPosterCaptionTitle(ad: AdItem): boolean {
    const t = String(ad.title ?? "").trim();
    if (!t) return false;
    const b = String(ad.businessName ?? "").trim();
    if (!b) return true;
    return t.toLowerCase() !== b.toLowerCase();
  }

  /** Sottotitolo: nascondi se uguale a nome o titolo. */
  showPosterCaptionSubtitle(ad: AdItem): boolean {
    const s = String(ad.subtitle ?? "").trim();
    if (!s) return false;
    const low = s.toLowerCase();
    const b = String(ad.businessName ?? "").trim().toLowerCase();
    const t = String(ad.title ?? "").trim().toLowerCase();
    if (b && low === b) return false;
    if (t && low === t) return false;
    return true;
  }

  /** Logo Comune nell’header → pagina istituzionale interna al totem. */
  onToolbarLogoClick(ev: Event): void {
    ev.preventDefault?.();
    void this.router
      .navigate(["/app/tabs/comune-castelraimondo"])
      .catch(() => {});
  }

  /**
   * Tap sul poster: solo navigazione interna verso il dettaglio attività (o route esplicita).
   * Nessun zoom fullscreen né link esterni sulla home kiosk.
   */
  onAdClick(ad: AdItem, event: Event): void {
    if (ad.kind !== "image") return;
    event.preventDefault();
    event.stopPropagation();
    this.stopAdsCarousel();

    this.openPosterFullscreen(ad);
  }

  /** Errore caricamento immagine poster: sostituisce con placeholder senza rimuovere la slide. */
  onPosterImageError(index: number): void {
    const ad = this.ads[index];
    if (!ad || ad.kind !== "image") return;
    if (this.kioskApi.isLikelyVideoAssetUrl(ad.src)) return;
    const fallback = String(ad.fallbackSrc || "").trim();
    if (fallback && fallback !== ad.src) {
      kioskDevWarn(
        "⚠️ [Tutorial] Poster non caricato — fallback a cover/logo attività:",
        ad.src
      );
      ad.src = fallback;
      this.ads = [...this.ads];
      return;
    }
    kioskDevWarn(
      "⚠️ [Tutorial] Poster non caricato — uso placeholder kiosk:",
      ad.src
    );
    ad.src = this.POSTER_PLACEHOLDER;
    this.ads = [...this.ads];
  }

  /** Pre-carica leggero la slide successiva per scroll più fluido (solo immagini). */
  private preloadAdjacentPosters(): void {
    if (this.ads.length < 2) return;
    const next = (this.adsIndex + 1) % this.ads.length;
    const src = this.ads[next]?.src;
    if (!src || src.endsWith(".svg")) return;
    const img = new Image();
    img.src = src;
  }

  // ========= SLIDE 3: VIDEO PRINCIPALE =========
  private setupIntersectionObserverForVideo() {
    this.io = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRatio > 0.6;
        this.isVideoActive = active;
        this.menu.enable(true);
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
    if (!v) return;
    try {
      v.muted = false;
      v.removeAttribute("muted");
      v.volume = 1;
      await v.play();
      this.muted = false;
      this.showUnmuteBtn = false;
      this.isPlaying = true;
    } catch {
      v.muted = true;
      v.setAttribute("muted", "");
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
        duration: 7_000,
        position: "bottom",
        cssClass: "toast-green",
        color: "success",
        buttons: [
          {
            text: "QR WhatsApp",
            handler: () => {
              void this.openWhatsAppSafe();
              return true;
            },
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
    if (this.supportAssistPromptShown) return;
    this.supportDelayTimer = setTimeout(() => {
      if (!this.isFirstSlideActive || this.supportAssistPromptShown) return;
      this.supportAssistPromptShown = true;
      this.supportBannerVisible = true;
    }, this.SUPPORT_BANNER_DELAY_MS);
  }

  private clearSupportTimers() {
    if (this.supportDelayTimer) {
      clearTimeout(this.supportDelayTimer);
      this.supportDelayTimer = undefined;
    }
    this.supportBannerVisible = false;
  }

  dismissSupportBanner() {
    this.supportBannerVisible = false;
  }

  // WhatsApp — QR generato in-app (nessuna API esterna; ok con kioskStrictMode)
  async openWhatsAppSafe() {
    const msg = "Ciao, nel totem ho notato un problema. Potete verificare?";
    const link = `https://wa.me/393899868381?text=${encodeURIComponent(msg)}`;
    this.supportWhatsappLink = link;
    this.supportQrSrc = "";
    this.supportQrLoading = true;
    this.supportModalOpen = true;
    try {
      const QRCode = (await import("qrcode")).default;
      this.supportQrSrc = await QRCode.toDataURL(link, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch (e) {
      kioskDevWarn("[Tutorial] QR WhatsApp non generato:", e);
      this.supportQrSrc = "";
    } finally {
      this.supportQrLoading = false;
    }
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

  closeSupportModal(ev?: Event, source: string = "unknown"): void {
    ev?.stopPropagation?.();
    this.supportModalOpen = false;
  }

  // Menu & Nav
  async toggleMenu() {
    try {
      await this.menu.enable(true, "main-menu");
      await this.menu.toggle("main-menu");
    } catch {}
  }

  startApp() {
    this.router
      .navigateByUrl("/app/tabs/schedule", { replaceUrl: true })
      .catch((err) => console.error("Errore durante startApp:", err));
  }

  openPremiumPlans(): void {
    this.router.navigateByUrl("/app/tabs/piani-premium").catch((err) => {
      console.error("Errore durante apertura piani premium:", err);
    });
  }

  @HostListener("click", ["$event"])
  @HostListener("pointerdown", ["$event"])
  @HostListener("touchstart", ["$event"])
  @HostListener("document:keydown", ["$event"])
  onTutorialHostTap(_event: Event): void {
    this.onTutorialInteraction();
  }
}