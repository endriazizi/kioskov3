import {
  Component,
  effect,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { SwUpdate } from "@angular/service-worker";
import { addIcons } from "ionicons";
import { firstValueFrom } from "rxjs";



import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar } from "@capacitor/status-bar";

import { Storage } from "@ionic/storage-angular";

import { FormsModule } from "@angular/forms";
import {
  IonApp,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSpinner,
  IonSplitPane,
  ActionSheetController,
  AlertController,
  MenuController,
  ModalController,
  Platform,
  PopoverController,
  ToastController,
} from "@ionic/angular/standalone";
import {
  arrowBackOutline,
  calendarOutline,
  help,
  homeOutline,
  informationCircleOutline,
  logIn,
  logoInstagram,
  logOut,
  mapOutline,
  moonOutline,
  peopleOutline,
  person,
  personAdd,
  informationCircle,
  informationCircleSharp,
  newspaper,
  newspaperOutline,
  leaf,
  leafOutline,
  pricetagsOutline,
} from "ionicons/icons";
import { UserService } from "./providers/user.service";
import { KioskLoadingService } from "./providers/kiosk-loading.service";
import { KioskApiService } from "./providers/kiosk-api.service";
import { environment } from "../environments/environment";
import { KioskWhitelistDirective } from "./security/kiosk-whitelist.directive";
import { KioskLocalHealthService } from "./services/kiosk-local-health.service";
import { kioskDevLog } from "./utils/kiosk-dev-console";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  imports: [
    RouterLink,
    RouterLinkActive,
    IonRouterOutlet,
    IonLabel,
    IonIcon,
    IonMenuToggle,
    IonList,
    IonListHeader,
    IonItem,
    IonContent,
    IonMenu,
    IonSplitPane,
    IonApp,
    IonSpinner,
    FormsModule,
    KioskWhitelistDirective,
  ],
  providers: [MenuController, ToastController],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private storage = inject(Storage);
  private userService = inject(UserService);
  private swUpdate = inject(SwUpdate);
  private toastCtrl = inject(ToastController);
  private menu = inject(MenuController);
  private modalCtrl = inject(ModalController);
  private popoverCtrl = inject(PopoverController);
  private alertCtrl = inject(AlertController);
  private actionSheetCtrl = inject(ActionSheetController);
  private platform = inject(Platform);
  readonly kioskLoading = inject(KioskLoadingService);
  private kioskApi = inject(KioskApiService);
  private kioskLocalHealth = inject(KioskLocalHealthService);

        // { title: "About", url: "/app/tabs/about", icon: "information-circle" },
  appPages = [
    { title: "Eventi", url: "/app/tabs/schedule", icon: "calendar-outline" },
    { title: "Attività", url: "/app/tabs/speakers", icon: "people" },
    { title: "Piani Premium", url: "/app/tabs/piani-premium", icon: "pricetags" },
    { title: "Map", url: "/app/tabs/map", icon: "map" },


    { title: "Turismo", url: "/app/tabs/turismo", icon: "information-circle" },
        { title: "Infiorata", url: "/app/tabs/infiorata", icon: "information-circle" },
    { title: "Vivere Camerino", url: "/app/tabs/vivere-camerino", icon: "newspaper" },
    { title: "Cronache Maceratesi", url: "/app/tabs/cronache-maceratesi", icon: "newspaper" },
    { title: "Picchio News", url: "/app/tabs/picchio-news", icon: "newspaper" },
    { title: "Cosmari", url: "/app/tabs/cosmari", icon: "leaf" }
  ];
  loggedIn = false;
  dark = false;

  private inactivityTimer: any;
  private inactivityEnabled = true;
  /** Default 60 s — override da API kiosk_idle_timeout_ms se useKioskPublicApi. */
  private inactivityTimeoutMs = 60000;

  constructor() {
    addIcons({
      calendarOutline,
      peopleOutline,
      mapOutline,
      informationCircleOutline,
      person,
      help,
      logOut,
      logIn,
      personAdd,
      moonOutline,
      homeOutline,
      logoInstagram,
      informationCircle,
      arrowBackOutline,
      newspaper,
      newspaperOutline,
      informationCircleSharp,
      leaf,
      leafOutline,
      pricetagsOutline,
    });

    effect(() => {
      this.kioskLoading.loading();
    });
  }

  // ========== Inattività: ascolta SOLO gesti reali, non lo scroll ==========
  @HostListener("document:pointerdown", ["$event"])
  @HostListener("document:keydown", ["$event"])
  @HostListener("document:touchstart", ["$event"])
  onUserAction(_event?: Event) {
    this.resetInactivityTimer();
  }

  // quando la tab torna visibile / finestra rifocalizzata → reset
  @HostListener("document:visibilitychange")
  onVisibilityChange() {
    if (document.visibilityState === "visible") {
      this.resetInactivityTimer();
    }
  }

  @HostListener("window:focus")
  onFocus() {
    this.resetInactivityTimer();
  }

  private resetInactivityTimer() {
    if (!this.inactivityEnabled) return;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      // evita redirect se sei già sulla home / tutorial
      if (this.isOnTutorial()) return;

      kioskDevLog("⏳ Timeout di inattività, torno alla Home Page");
      void this.closeOverlaysForIdle()
        .then(() =>
          this.router.navigate(["/app/tabs/home"], {
            replaceUrl: true,
            queryParams: { idleFs: "1" },
          })
        )
        .catch(() => {})
        // Settings admin modificati a runtime: valgono dal prossimo ciclo senza reload.
        .then(() => this.loadKioskIdleRuntimeConfig());
    }, this.inactivityTimeoutMs);
  }

  /** Modal/popover/alert/menu restano sopra la Home dopo il redirect: vanno chiusi prima. */
  private async closeOverlaysForIdle(): Promise<void> {
    const ctrls = [this.modalCtrl, this.popoverCtrl, this.alertCtrl, this.actionSheetCtrl];
    for (const ctrl of ctrls) {
      for (let i = 0; i < 5; i++) {
        const top = await ctrl.getTop().catch(() => undefined);
        if (!top) break;
        await top.dismiss(undefined, "kiosk-idle").catch(() => false);
      }
    }
    await this.menu.close().catch(() => false);
  }

  private isOnTutorial(): boolean {
    // normalizza il path corrente (ignora query/hash)
    const tree = this.router.parseUrl(this.router.url);
    const current =
      "/" +
      (tree.root.children["primary"]?.segments.map((s) => s.path).join("/") ??
        "");
    // /v2 ha il proprio timer di inattività (V2IdleService): qui non deve reindirizzare.
    if (current === "/v2" || current.startsWith("/v2/")) return true;
    return current === "/tutorial" || current === "/app/tabs/home";
  }

  // ========================================================================

  async ngOnInit() {
    this.initializeApp();
    await this.storage.create();
    this.checkLoginStatus();
    this.listenForLoginEvents();

    await this.loadKioskIdleRuntimeConfig();
    this.resetInactivityTimer();
    this.kioskLocalHealth.start();

    // Service Worker update toast
    this.swUpdate.versionUpdates.subscribe(async () => {
      const toast = await this.toastCtrl.create({
        message: "Update available!",
        position: "bottom",
        buttons: [{ role: "cancel", text: "Reload" }],
      });
      await toast.present();
      toast
        .onDidDismiss()
        .then(() => this.swUpdate.activateUpdate())
        .then(() => window.location.reload());
    });
  }

  private async loadKioskIdleRuntimeConfig(): Promise<void> {
    if (!environment.useKioskPublicApi) return;
    try {
      const raw = await firstValueFrom(this.kioskApi.getHome());
      const cfg = this.kioskApi.unwrapIdleFullscreenConfig(raw);
      this.inactivityEnabled = !!cfg.enabled;
      this.inactivityTimeoutMs = cfg.timeoutMs;
      kioskDevLog("⚙️ [App] Inattività runtime:", {
        enabled: this.inactivityEnabled,
        timeoutMs: this.inactivityTimeoutMs,
      });
    } catch {
      // fallback ai default hardcoded
    }
  }

  initializeApp() {
    this.platform.ready().then(() => {
      if (this.platform.is("hybrid")) {
        StatusBar.hide();
        SplashScreen.hide();
      }
    });
  }

  checkLoginStatus() {
    return this.userService.isLoggedIn().then((loggedIn) => {
      return this.updateLoggedInStatus(loggedIn);
    });
  }

  updateLoggedInStatus(loggedIn: boolean) {
    setTimeout(() => {
      this.loggedIn = loggedIn;
    }, 300);
  }

  listenForLoginEvents() {
    window.addEventListener("user:login", () => this.updateLoggedInStatus(true));
    window.addEventListener("user:signup", () => this.updateLoggedInStatus(true));
    window.addEventListener("user:logout", () => this.updateLoggedInStatus(false));
  }

  logout() {
    this.userService.logout().then(() => {
      return this.router.navigateByUrl("/app/tabs/schedule");
    });
  }

  openTutorial() {
    this.menu.enable(true);
    void this.menu.close().catch(() => {});
    void this.router.navigateByUrl("/app/tabs/home");
  }

  toggleDarkMode() {
    document.documentElement.classList.toggle("ion-palette-dark", this.dark);
  }

  ngOnDestroy(): void {
    this.kioskLocalHealth.stop();
  }
}
