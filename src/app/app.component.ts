import {
  Component,
  effect,
  HostListener,
  inject,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { SwUpdate } from "@angular/service-worker";
import { addIcons } from "ionicons";



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
  MenuController,
  Platform,
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
  leafOutline
  
} from "ionicons/icons";
import { UserService } from "./providers/user.service";
import { KioskLoadingService } from "./providers/kiosk-loading.service";
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
  ],
  providers: [MenuController, ToastController],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private storage = inject(Storage);
  private userService = inject(UserService);
  private swUpdate = inject(SwUpdate);
  private toastCtrl = inject(ToastController);
  private menu = inject(MenuController);
  private platform = inject(Platform);
  readonly kioskLoading = inject(KioskLoadingService);

        // { title: "About", url: "/app/tabs/about", icon: "information-circle" },
  appPages = [
    { title: "Eventi", url: "/app/tabs/schedule", icon: "calendar-outline" },
    { title: "Attività", url: "/app/tabs/speakers", icon: "people" },
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
  private readonly TIMEOUT = 10000; // 10 secondi reali

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
      leaf,leafOutline
    });

    effect(() => {
      const loading = this.kioskLoading.loading();
      // #region agent log
      fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H1',location:'app.component.ts:constructor:effect',message:'Global loading signal changed',data:{loading,route:this.router.url},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });
  }

  // ========== Inattività: ascolta SOLO gesti reali, non lo scroll ==========
  @HostListener("document:pointerdown", ["$event"])
  @HostListener("document:keydown", ["$event"])
  @HostListener("document:touchstart", ["$event"])
  onUserAction(event?: Event) {
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H2',location:'app.component.ts:onUserAction',message:'Global user action captured',data:{eventType:event?.type ?? null,targetTag:(event?.target as HTMLElement | null)?.tagName ?? null,targetClass:(event?.target as HTMLElement | null)?.className ?? null,route:this.router.url},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.logTapProbe(event);
    this.resetInactivityTimer();
  }

  private logTapProbe(event?: Event): void {
    const anyEv = event as (MouseEvent & TouchEvent) | undefined;
    const x = typeof anyEv?.clientX === "number" ? anyEv.clientX : (anyEv?.touches?.[0]?.clientX ?? null);
    const y = typeof anyEv?.clientY === "number" ? anyEv.clientY : (anyEv?.touches?.[0]?.clientY ?? null);
    const topEl = x != null && y != null ? document.elementFromPoint(x, y) as HTMLElement | null : null;
    const loadingOverlay = document.querySelector(".kiosk-api-loading-overlay") as HTMLElement | null;
    const clickable = (event?.target as HTMLElement | null)?.closest?.("button, a, ion-button, ion-tab-button, [role='button']");
    const topStack = x != null && y != null
      ? document
          .elementsFromPoint(x, y)
          .slice(0, 6)
          .map((el) => {
            const he = el as HTMLElement;
            const cs = getComputedStyle(he);
            return {
              tag: he.tagName,
              cls: he.className,
              pe: cs.pointerEvents,
              z: cs.zIndex,
              pos: cs.position,
              op: cs.opacity,
            };
          })
      : [];
    // #region agent log
    fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H4',location:'app.component.ts:logTapProbe',message:'Tap probe with top element and overlay state',data:{eventType:event?.type ?? null,route:this.router.url,coords:{x,y},targetTag:(event?.target as HTMLElement | null)?.tagName ?? null,targetClass:(event?.target as HTMLElement | null)?.className ?? null,topTag:topEl?.tagName ?? null,topClass:topEl?.className ?? null,clickableTag:clickable?.tagName ?? null,clickableClass:clickable?.className ?? null,overlayPresent:!!loadingOverlay,overlayPointerEvents:loadingOverlay ? getComputedStyle(loadingOverlay).pointerEvents : null,overlayDisplay:loadingOverlay ? getComputedStyle(loadingOverlay).display : null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    void this.menu.isOpen().then((isOpen) => {
      // #region agent log
      fetch('http://127.0.0.1:7727/ingest/c4e926a9-a777-4a16-97cd-643defec2cb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'378a0a'},body:JSON.stringify({sessionId:'378a0a',runId:'pre-fix',hypothesisId:'H5',location:'app.component.ts:logTapProbe:menu-stack',message:'Tap probe menu and element stack',data:{route:this.router.url,eventType:event?.type ?? null,menuOpen:isOpen,topStack},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }).catch(() => {});
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
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      // evita redirect se sei già sulla home / tutorial
      if (this.isOnTutorial()) return;

      kioskDevLog("⏳ Timeout di inattività, torno alla Home Page");
      void this.router.navigateByUrl("/app/tabs/home", { replaceUrl: true }).catch(() => {});
    }, this.TIMEOUT);
  }

  private isOnTutorial(): boolean {
    // normalizza il path corrente (ignora query/hash)
    const tree = this.router.parseUrl(this.router.url);
    const current =
      "/" +
      (tree.root.children["primary"]?.segments.map((s) => s.path).join("/") ??
        "");
    return current === "/tutorial" || current === "/app/tabs/home";
  }

  // ========================================================================

  async ngOnInit() {
    this.initializeApp();
    await this.storage.create();
    this.checkLoginStatus();
    this.listenForLoginEvents();
    document.addEventListener("click", (ev) => this.logTapProbe(ev), true);
    document.addEventListener("pointerdown", (ev) => this.logTapProbe(ev), true);

    // avvia il timer di inattività al boot
    this.resetInactivityTimer();

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
    this.menu.enable(false);
    void this.router.navigateByUrl("/app/tabs/home");
  }

  toggleDarkMode() {
    document.documentElement.classList.toggle("ion-palette-dark", this.dark);
  }
}
