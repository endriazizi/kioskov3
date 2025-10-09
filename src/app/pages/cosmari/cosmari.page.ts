import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonButtons, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import { arrowBackOutline, lockClosedOutline } from 'ionicons/icons';

declare var cordova: any;

@Component({
  selector: 'app-cosmari',
  standalone: true,
  templateUrl: './cosmari.page.html',
  styleUrls: ['./cosmari.page.scss'],
  imports: [NgIf, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon],
})
export class CosmariPage implements OnInit {
  // Prefisso CONSENTITO
  private readonly BASE = 'https://cosmariambiente.it/comuni/castelraimondo';
  private readonly ALLOWED_PREFIXES = [
    'https://cosmariambiente.it/comuni/castelraimondo',
    'https://cosmariambiente.it/comuni/castelraimondo/'
  ];

  @ViewChild('frame', { static: false }) frame?: ElementRef<HTMLIFrameElement>;

  isBrowser = false;
  safeUrl: SafeResourceUrl | null = null;
  canIframe = true;              // fallback se l’iframe non riesce a caricarsi
  private ref: any;
  private iframeLoadTimer?: any; // euristica per capire se l’embed è bloccato

  constructor(private router: Router, private sanitizer: DomSanitizer) {
    addIcons({ arrowBackOutline, lockClosedOutline });
  }

  ngOnInit() {
    // PWA / Browser: prova iframe
    if (!(window as any).cordova) {
      this.isBrowser = true;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.BASE);
      // se dopo 2.5s non abbiamo un load “utile”, mostriamo fallback
      this.iframeLoadTimer = setTimeout(() => {
        this.canIframe = false; // probabilmente X-Frame-Options / CSP frame-ancestors
      }, 2500);
      return;
    }

    // Device (Cordova/Capacitor): ThemeableBrowser con filtro per prefisso
    try {
      this.ref = cordova?.ThemeableBrowser?.open(this.BASE, '_blank', {
        toolbar: { height: 50, color: '#222222' },
        closeButton: { wwwImage: 'assets/icon/close.png', align: 'left', event: 'closePressed' },
      });

      this.ref?.addEventListener?.('closePressed', () => this.ref?.close?.());

      this.ref?.addEventListener?.('loadstart', (ev: any) => {
        const url: string = ev?.url || '';
        const allowed = this.ALLOWED_PREFIXES.some(prefix => url.startsWith(prefix));
        if (!allowed) {
          try { this.ref.stop(); } catch {}
          this.ref.executeScript({ code: "alert('Navigazione non consentita in modalità kiosk');" });
          this.ref.executeScript({ code: `window.location.href='${this.BASE}';` });
        }
      });
    } catch {
      window.open(this.BASE, '_system');
    }
  }

  onIframeLoad() {
    // se arriva almeno un load, sospendi il fallback
    if (this.iframeLoadTimer) {
      clearTimeout(this.iframeLoadTimer);
      this.iframeLoadTimer = undefined;
    }
  }

  openExternal() {
    window.open(this.BASE, '_blank', 'noopener');
  }

  goBack() {
    try { this.ref?.close?.(); } catch {}
    this.router.navigate(['/app/tabs/speakers']);
  }
}
