import { Routes } from '@angular/router';

import { V2ShellComponent } from './v2-shell.component';

/** Totem v2, in parallelo all'app attuale: si apre con /v2 (opzionale ?design=A|B). */
export const V2_ROUTES: Routes = [
  {
    path: '',
    component: V2ShellComponent,
    children: [
      { path: '', loadComponent: () => import('./pages/v2-home.page').then((m) => m.V2HomePage) },
      { path: 'attivita', loadComponent: () => import('./pages/v2-list.page').then((m) => m.V2ListPage) },
      { path: 'attivita/:slug', loadComponent: () => import('./pages/v2-detail.page').then((m) => m.V2DetailPage) },
      { path: 'eventi', loadComponent: () => import('./pages/v2-events.page').then((m) => m.V2EventsPage) },
      { path: 'cerca', loadComponent: () => import('./pages/v2-search.page').then((m) => m.V2SearchPage) },
      { path: '**', redirectTo: '' },
    ],
  },
];
