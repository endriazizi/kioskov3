import {
  Component,
  DestroyRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuController } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { V2CatalogStore } from './v2-catalog.store';
import { V2IdleService } from './v2-idle.service';
import { V2RealtimeService } from './v2-realtime.service';
import { V2UiState } from './v2-ui.state';
import { V2KeyboardComponent } from './v2-keyboard.component';
import { V2IconComponent } from './v2-icon.component';

@Component({
  selector: 'app-v2-shell',
  standalone: true,
  imports: [V2IconComponent, RouterOutlet, RouterLink, RouterLinkActive, V2KeyboardComponent],
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./v2.scss'],
  template: `
    <div class="v2" [attr.data-design]="ui.design()" [class.v2-portrait]="portrait()">
      <header class="v2-head">
        <div class="v2-brand"><i aria-hidden="true"></i><span>Castelraimondo <small>Info Point</small></span></div>
        <div class="v2-status">
          @if (store.stale()) {
            <span class="v2-chip off">Offline · dati delle {{ syncLabel() }}</span>
          } @else if (realtime.live()) {
            <span class="v2-chip live">In diretta · {{ syncLabel() }}</span>
          } @else if (store.lastSyncAt()) {
            <span class="v2-chip">Aggiornato {{ syncLabel() }}</span>
          }
          <span class="v2-clock">{{ clock() }}</span>
        </div>
      </header>

      <main class="v2-main">
        <router-outlet />
        @if (ui.keyboardOpen()) {
          <app-v2-keyboard />
        }
        @if (ui.toast(); as t) {
          <div class="v2-toast" role="status">{{ t }}</div>
        }
        @if (attract()) {
          <button class="v2-attract" type="button" (click)="attract.set(false)">
            <span class="v2-attract-title">Benvenuti a Castelraimondo</span>
            <span class="v2-attract-hint">Tocca lo schermo per iniziare</span>
          </button>
        }
      </main>

      <nav class="v2-dock" aria-label="Navigazione">
        <a class="home" routerLink="/v2" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" (click)="goHome()">
          <app-v2-icon name="home" /><span>Home</span>
        </a>
        <a routerLink="/v2/attivita" routerLinkActive="on"><app-v2-icon name="list" /><span>Attività</span></a>
        <a routerLink="/v2/eventi" routerLinkActive="on"><app-v2-icon name="cal" /><span>Eventi</span></a>
        <a routerLink="/v2/cerca" routerLinkActive="on"><app-v2-icon name="search" /><span>Cerca</span></a>
      </nav>
    </div>
  `,
})
export class V2ShellComponent implements OnInit, OnDestroy {
  readonly store = inject(V2CatalogStore);
  readonly ui = inject(V2UiState);
  private readonly idle = inject(V2IdleService);
  readonly realtime = inject(V2RealtimeService);
  private readonly router = inject(Router);
  private readonly menu = inject(MenuController);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  readonly attract = signal(false);
  readonly clock = signal(this.formatClock());
  readonly portrait = signal(window.innerHeight > window.innerWidth);
  readonly syncLabel = computed(() => {
    const t = this.store.lastSyncAt();
    if (!t) return '--:--';
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  private clockTimer?: ReturnType<typeof setInterval>;
  private readonly onResize = () => this.portrait.set(window.innerHeight > window.innerWidth);

  constructor() {
    // Inattività: prima torna alla Home azzerando la sessione, al giro successivo mostra il benvenuto.
    effect(() => {
      if (!this.idle.expired()) return;
      const onHome = this.isHome();
      if (!onHome || this.ui.query() || this.ui.keyboardOpen()) {
        this.ui.resetSession();
        void this.router.navigateByUrl('/v2', { replaceUrl: true });
      } else {
        this.attract.set(true);
      }
    });
    effect(() => {
      const added = this.store.lastAdded();
      if (added && Date.now() - added.at < 5000) {
        this.ui.showToast(`Nuova attività sul totem: ${added.names.slice(0, 3).join(', ')}`);
      }
    });
  }

  ngOnInit(): void {
    void this.menu.enable(false, 'main-menu');
    this.store.start();
    this.realtime.start();
    this.idle.start();
    this.zone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => {
        const next = this.formatClock();
        if (next !== this.clock()) this.zone.run(() => this.clock.set(next));
      }, 10_000);
      window.addEventListener('resize', this.onResize);
    });
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.ui.keyboardOpen.set(this.router.url.startsWith('/v2/cerca')));
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
    window.removeEventListener('resize', this.onResize);
    this.idle.stop();
    this.realtime.stop();
    this.store.stop();
    void this.menu.enable(true, 'main-menu');
  }

  goHome(): void {
    this.ui.resetSession();
  }

  private isHome(): boolean {
    const path = this.router.url.split('?')[0].replace(/\/$/, '');
    return path === '/v2';
  }

  private formatClock(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
