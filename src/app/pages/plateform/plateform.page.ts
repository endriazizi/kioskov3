import { Component, inject, OnInit, AfterViewInit, Renderer2 } from "@angular/core";
import { NgIf } from "@angular/common";
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonButtons, IonButton, IonIcon, IonNote
} from "@ionic/angular/standalone";
import { Router, ActivatedRoute } from "@angular/router";
import { DomSanitizer, SafeResourceUrl, SafeHtml } from "@angular/platform-browser";
import { isPlatform, ToastController } from "@ionic/angular";
import { Browser } from "@capacitor/browser";
import { Speaker } from "../../interfaces/conference.interfaces";
import { ConferenceService } from "../../providers/conference.service";

declare var cordova: any;

@Component({
  selector: "app-plateform",
  templateUrl: "./plateform.page.html",
  styleUrls: ["./plateform.page.scss"],
  standalone: true,
  imports: [IonNote, NgIf, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon],
})
export class PlateformPage implements OnInit, AfterViewInit {
  isBrowser = false;
  private ref: any;

  private confData = inject(ConferenceService);
  private toastCtrl = inject(ToastController);
  speakers: Speaker[] = [];

  url = "";
  safeUrl: SafeResourceUrl | null = null;

  canIframe = false;
  embedHtml?: SafeHtml;
  canIframeFeed = false;

  // ⛔ EXACT URL (with or without querystring)
  private readonly BLOCK_RX =
    /https?:\/\/(www\.)?elfsight\.com\/instagram-feed-instashow\/?(?:\?.*)?$/i;
  blockedUrl = false;

  // ✅ Allow these schemes to still work
  private readonly ALLOWED_SCHEMES = new Set(["tel:", "mailto:"]);

  // FIX: flag per attivare la policy “non uscire dall’app” SOLO nel ramo else (site mode)
  private siteModeActive = false; // FIX

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private renderer: Renderer2
  ) {}

  ionViewDidEnter() {
    this.confData.getSpeakers().subscribe((speakers) => (this.speakers = speakers));
  }

  ngOnInit() {
    const encoded = this.route.snapshot.paramMap.get("id");
    console.debug("[Plateform] route param id =", encoded);

    if (encoded === "feed") {
      this.canIframeFeed = true;
      this.ensureElfsightPlatformLoaded().then(() => {
        console.debug("[Plateform] platform.js loaded");
        setTimeout(() => (window as any).eapps?.initialize?.(), 0);
      });
    } else {
      this.url = decodeURIComponent(encoded || "https://ludwigstrasse.plateform.app/");
      console.debug("[Plateform] url =", this.url);

      if (this.BLOCK_RX.test(this.url)) {
        this.blockedUrl = true;
        console.warn("[Plateform] blocked by policy:", this.url);
        this.toast("Navigation blocked by kiosk policy.");
        this.url = "";
      }

      // 👇 AGGIUNTO: rendi visibile l’iframe con la pagina
      this.canIframe = !!this.url; // FIX
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url); // FIX

      // 👇 AGGIUNTO: attiva blocco link/bottoni verso fuori SOLO in site mode (questo else)
      this.siteModeActive = true; // FIX
    }

    this.isBrowser = !("cordova" in (window as any));
    console.debug("[Plateform] isBrowser =", this.isBrowser);

    // Intercetta click su <a> (web/PWA)
    if (this.isBrowser) {
      this.renderer.listen(document, "click", (ev: Event) => {
        const el = ev.target as HTMLElement;
        const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a) return;

        const href = a.href;

        // 1) blocco esplicito marketing
        if (this.BLOCK_RX.test(href)) {
          ev.preventDefault();
          ev.stopPropagation();
          console.warn("[Plateform] blocked click (marketing):", href);
          this.toast("Navigation blocked by kiosk policy.");
          return;
        }

        // 2) SOLO quando siamo nel ramo else (site mode) blocca uscite dall'app
        if (this.siteModeActive && this.isGoingOutOfApp(href)) { // FIX
          ev.preventDefault();
          ev.stopPropagation();
          console.warn("[Plateform] blocked external navigation:", href);
          this.toast("Navigation blocked in kiosk.");
          return;
        }
      });
    }
  }

  ngAfterViewInit() {
    if (this.canIframeFeed) {
      setTimeout(() => (window as any).eapps?.initialize?.(), 0);
    }
  }

  /** Load Elfsight platform.js once */
  private ensureElfsightPlatformLoaded(): Promise<void> {
    return new Promise((resolve) => {
      const already = document.querySelector("script[data-elfsight-platform]");
      if (already) {
        console.debug("[Plateform] platform.js already present");
        resolve();
        return;
      }
      const s = this.renderer.createElement("script");
      s.src = "https://elfsightcdn.com/platform.js";
      s.async = true;
      s.defer = true;
      s.setAttribute("data-elfsight-platform", "1");
      s.onload = () => resolve();
      s.onerror = () => {
        console.error("[Plateform] failed to load platform.js");
        resolve();
      };
      this.renderer.appendChild(document.body, s);
    });
  }

  // Guarded opener (usa questo anziché window.open/Browser.open)
  async openExternal(url: string) {
    // blocco esplicito marketing
    if (this.BLOCK_RX.test(url)) {
      console.warn("[Plateform] blocked openExternal (marketing):", url);
      await this.toast("Navigation blocked by kiosk policy.");
      return;
    }

    // FIX: blocca le uscite dall’app SOLO nel ramo else (site mode)
    if (this.siteModeActive && this.isGoingOutOfApp(url)) { // FIX
      console.warn("[Plateform] blocked openExternal (external origin):", url);
      await this.toast("Navigation blocked in kiosk.");
      return;
    }

    if (isPlatform("capacitor"))
      await Browser.open({ url, presentationStyle: "fullscreen" });
    else window.open(url, "_blank", "noopener");
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 1500, color: "danger" });
    await t.present();
  }

  /** true se il link porterebbe fuori dall’origin dell’app */
  private isGoingOutOfApp(href: string): boolean {
    try {
      const proto = href.split(":", 1)[0] + ":";
      if (this.ALLOWED_SCHEMES.has(proto)) return false; // tel/mailto ok

      const target = new URL(href, window.location.href);
      const appOrigin = new URL(window.location.href).origin;

      // stesso origin = consentito
      if (target.origin === appOrigin) return false;

      // altrimenti sta uscendo
      return true;
    } catch {
      return true; // se non parsabile, blocca per sicurezza
    }
  }

  goBack() {
    if (this.ref) this.ref.close();
    this.router.navigate(["/app/tabs/speakers"]);
  }
}
