import {
  Component,
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
  IonSplitPane,
  IonToggle,
  MenuController,
  Platform,
  ToastController,
} from "@ionic/angular/standalone";
import {
  arrowBackOutline,
  calendarOutline,
  hammer,
  help,
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
  newspaperSharp,
} from "ionicons/icons";
import { UserService } from "./providers/user.service";

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
    IonToggle,
    IonList,
    IonListHeader,
    IonItem,
    IonContent,
    IonMenu,
    IonSplitPane,
    IonApp,
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
    // { title: "Infiorata", url: "/app/tabs/infiorata", icon: "information-circle" },
        // { title: "About", url: "/app/tabs/about", icon: "information-circle" },
  appPages = [
    { title: "Eventi", url: "/app/tabs/schedule", icon: "calendar" },
    { title: "Attività", url: "/app/tabs/speakers", icon: "people" },
    { title: "Map", url: "/app/tabs/map", icon: "map" },


    { title: "Turismo", url: "/app/tabs/turismo", icon: "information-circle" },
    { title: "Vivere Camerino", url: "/app/tabs/vivere-camerino", icon: "newspaper" },
    { title: "Cronache Maceratesi", url: "/app/tabs/cronache-maceratesi", icon: "newspaper" },
    { title: "Picchio News", url: "/app/tabs/picchio-news", icon: "newspaper" },
  ];
  loggedIn = false;
  dark = false;

  private inactivityTimer: any;
  private readonly TIMEOUT = 60000 // 20 secondi reali

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
      hammer,
      logoInstagram,
      informationCircle,
      arrowBackOutline,
      newspaper,
      newspaperOutline,
      informationCircleSharp,
      newspaperSharp,
    });
  }

  // ========== Inattività: ascolta SOLO gesti reali, non lo scroll ==========
  @HostListener("document:pointerdown")
  @HostListener("document:keydown")
  @HostListener("document:touchstart")
  onUserAction() {
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
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      // evita redirect se sei già su /tutorial
      if (this.isOnTutorial()) return;

      console.log("⏳ Timeout di inattività, torno al tutorial");
      this.router.navigateByUrl("/tutorial", { replaceUrl: true })
        .catch(() => {});
    }, this.TIMEOUT);
  }

  private isOnTutorial(): boolean {
    // normalizza il path corrente (ignora query/hash)
    const tree = this.router.parseUrl(this.router.url);
    const current =
      "/" +
      (tree.root.children["primary"]?.segments.map((s) => s.path).join("/") ??
        "");
    return current === "/tutorial";
  }

  // ========================================================================

  async ngOnInit() {
    this.initializeApp();
    await this.storage.create();
    this.checkLoginStatus();
    this.listenForLoginEvents();

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
    this.storage.set("ion_did_tutorial", false);
    this.router.navigateByUrl("/tutorial");
  }

  toggleDarkMode() {
    document.documentElement.classList.toggle("ion-palette-dark", this.dark);
  }
}
