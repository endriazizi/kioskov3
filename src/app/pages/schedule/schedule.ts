import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import QRCode from 'qrcode';
import { addIcons } from 'ionicons';
import { options, search } from 'ionicons/icons';

import { LowerCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  Config,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonItemGroup,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenuButton,
  IonRouterOutlet,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController, IonItem } from '@ionic/angular/standalone';
import { Group, Session } from '../../interfaces/conference.interfaces';
import { ConferenceService } from '../../providers/conference.service';
import { UserService } from '../../providers/user.service';
import { ScheduleFilterPage } from '../schedule-filter/schedule-filter';
import { environment } from '../../../environments/environment';
import { kioskDevWarn } from '../../utils/kiosk-dev-console';

@Component({
    selector: 'page-schedule',
    templateUrl: 'schedule.html',
    styleUrls: ['./schedule.scss'],
    imports: [IonItem,
        IonHeader,
        IonToolbar,
        IonButtons,
        IonSegment,
        IonSegmentButton,
        IonContent,
        IonTitle,
        IonSearchbar,
        IonButton,
        IonIcon,
        IonList,
        IonListHeader,
        FormsModule,
        IonItemSliding,
        LowerCasePipe,
        IonItemGroup,
        IonItemDivider,
        IonItemOption,
        IonItemOptions,
        IonLabel,
        IonMenuButton,
    ],
    providers: [
        ModalController,
        AlertController,
        ToastController,
        Config,
    ]
})
export class SchedulePage implements OnInit {
  private router = inject(Router);
  alertCtrl = inject(AlertController);
  confService = inject(ConferenceService);
  modalCtrl = inject(ModalController);
  routerOutlet = inject(IonRouterOutlet);
  toastCtrl = inject(ToastController);
  user = inject(UserService);
  config = inject(Config);

  // Gets a reference to the list element
  @ViewChild('scheduleList', { static: true }) scheduleList: IonList;

  ios: boolean;
  dayIndex = 0;
  queryText = '';
  segment = 'all';
  excludeTrackNames: string[] = [];
  shownSessions: number;
  groups: Group[] = [];
  confDate: string;
  showSearchbar: boolean;
  /** QR wa.me per segnalazioni eventi (se `eventsWhatsAppNumber` è configurato). */
  whatsappQrDataUrl = '';
  /** Primo evento con data ≥ oggi (locale), tra le righe attualmente visibili (filtri/segmento). */
  highlightUpcomingSessionId: string | null = null;
  private scrollFirstUpcomingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({ search, options });
  }

  ngOnInit() {
    this.updateSchedule();
    this.ios = this.config.get('mode') === 'ios';
    void this.buildWhatsappQr();
  }

  /** Navigazione esplicita: evita edge case routerLink/anchor vs whitelist kiosk su totem touch. */
  openSessionDetail(session: Session): void {
    void this.router.navigate(['/app/tabs/schedule/session', session.id]);
  }

  ngOnDestroy(): void {
    if (this.scrollFirstUpcomingTimer) {
      clearTimeout(this.scrollFirstUpcomingTimer);
      this.scrollFirstUpcomingTimer = null;
    }
  }

  private whatsAppSuggestUrl(): string {
    const raw = String(environment.eventsWhatsAppNumber || '').replace(/\D/g, '');
    if (!raw.length) return '';
    const text = encodeURIComponent(
      environment.eventsWhatsAppPrefillText ||
        'Segnala un evento per il calendario comunale: '
    );
    return `https://wa.me/${raw}?text=${text}`;
  }

  private async buildWhatsappQr(): Promise<void> {
    const url = this.whatsAppSuggestUrl();
    if (!url) return;
    try {
      this.whatsappQrDataUrl = await QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        color: { dark: '#075e54ff', light: '#ffffffff' },
      });
    } catch (e) {
      kioskDevWarn('⚠️ [Schedule] QR WhatsApp', e);
    }
  }

  private todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  isTodaySession(session: Session): boolean {
    return !!session.eventDateIso && session.eventDateIso === this.todayIsoLocal();
  }

  /**
   * Primo evento “disponibile”: prima data ISO ≥ oggi (timezone locale), rispettando l’ordine
   * dei gruppi (giorni) e delle sessioni nel gruppo (già ordinato per ora).
   */
  private findFirstUpcomingSessionId(groups: Group[]): string | null {
    const today = this.todayIsoLocal();
    for (const g of groups) {
      if (g.hide) continue;
      for (const s of g.sessions) {
        if (s.hide) continue;
        const d = s.eventDateIso;
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        if (d >= today) return s.id;
      }
    }
    return null;
  }

  private scheduleScrollToFirstUpcoming(): void {
    if (this.scrollFirstUpcomingTimer) clearTimeout(this.scrollFirstUpcomingTimer);
    this.scrollFirstUpcomingTimer = setTimeout(() => {
      const id = this.highlightUpcomingSessionId;
      if (!id) return;
      const el = document.querySelector(
        `ion-item-sliding[data-session-scroll="${CSS.escape(id)}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 520);
  }

  updateSchedule() {
    // Close any open sliding items when the schedule updates
    if (this.scheduleList) {
      this.scheduleList.closeSlidingItems();
    }

    this.confService
      .getTimeline(
        this.dayIndex,
        this.queryText,
        this.excludeTrackNames,
        this.segment
      )
      .subscribe((data) => {
        this.shownSessions = data.shownSessions;
        this.groups = data.groups;
        this.highlightUpcomingSessionId = this.findFirstUpcomingSessionId(data.groups);
        this.scheduleScrollToFirstUpcoming();
      });
  }

  async presentFilter() {
    const modal = await this.modalCtrl.create({
      component: ScheduleFilterPage,
      presentingElement: this.routerOutlet.nativeEl,
      componentProps: { excludedTracks: this.excludeTrackNames },
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      this.excludeTrackNames = data;
      this.updateSchedule();
    }
  }

  async addFavorite(slidingItem: IonItemSliding, sessionData: Session) {
    if (this.user.hasFavorite(sessionData.name)) {
      // Prompt to remove favorite
      this.removeFavorite(slidingItem, sessionData, 'Favorite already added');
    } else {
      // Add as a favorite
      this.user.addFavorite(sessionData.name);

      // Close the open item
      slidingItem.close();

      // Create a toast
      const toast = await this.toastCtrl.create({
        header: `${sessionData.name} was successfully added as a favorite.`,
        duration: 3000,
        buttons: [
          {
            text: 'Close',
            role: 'cancel',
          },
        ],
      });

      // Present the toast at the bottom of the page
      await toast.present();
    }
  }

  async removeFavorite(
    slidingItem: IonItemSliding,
    sessionData: Session,
    title: string
  ) {
    const alert = await this.alertCtrl.create({
      header: title,
      message: 'Would you like to remove this session from your favorites?',
      buttons: [
        {
          text: 'Cancel',
          handler: () => {
            // they clicked the cancel button, do not remove the session
            // close the sliding item and hide the option buttons
            slidingItem.close();
          },
        },
        {
          text: 'Remove',
          handler: () => {
            // they want to remove this session from their favorites
            this.user.removeFavorite(sessionData.name);
            this.updateSchedule();

            // close the sliding item and hide the option buttons
            slidingItem.close();
          },
        },
      ],
    });
    // now present the alert on top of all other content
    await alert.present();
  }
}
