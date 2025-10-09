import { Routes } from '@angular/router';
import { TabsPage } from './tabs-page';

export const TABS_ROUTES: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'schedule',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../schedule/schedule').then(m => m.SchedulePage),
          },
          {
            path: 'session/:sessionId',
            loadComponent: () =>
              import('../session-detail/session-detail').then(
                m => m.SessionDetailPage
              ),
          },
        ],
      },
      {
        path: 'speakers',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../speaker-list/speaker-list').then(
                m => m.SpeakerListPage
              ),
          },
          {
            path: 'session/:sessionId',
            loadComponent: () =>
              import('../session-detail/session-detail').then(
                m => m.SessionDetailPage
              ),
          },
          {
            path: 'speaker-details/:speakerId',
            loadComponent: () =>
              import('../speaker-detail/speaker-detail').then(
                m => m.SpeakerDetailPage
              ),
          },
        ],
      },
      {
        path: 'map',
        loadComponent: () => import('../map/map').then(m => m.MapPage),
      },
      {
        path: 'about',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../about/about').then(m => m.AboutPage),
          },
        ],
      },

           // 👇 AGGIUNTA LA ROTTA PLATEFORM DENTRO I TABS
      {
        path: 'plateform/:id',
        loadComponent: () =>
          import('../plateform/plateform.page').then(m => m.PlateformPage),
      },
  {
    path: 'infiorata',
    loadComponent: () =>
      import('../infiorata/infiorata.page').then(m => m.InfiorataPage),
  },
    {
    path: 'turismo',
    loadComponent: () =>
      import('../turismo/turismo.page').then(m => m.TurismoPage),
  },

  {
    path: 'vivere-camerino',
    loadComponent: () =>
      import('../vivere-camerino/vivere-camerino.page')
        .then(m => m.VivereCamerinoPage),
  },
   {
    path: 'cronache-maceratesi',
    loadComponent: () =>
      import('../cronache-maceratesi/cronache-maceratesi.page')
        .then(m => m.CronacheMaceratesiPage),
  },
     {
    path: 'picchio-news',
    loadComponent: () =>
      import('../picchio-news/picchio-news.page')
        .then(m => m.PicchioNewsPage),
  },

    {
    path: 'comune-castelraimondo',
    loadComponent: () =>
      import('../comune-castelraimondo/comune-castelraimondo.page')
        .then(m => m.ComuneCastelraimondoPage),
  },
      
      {
        path: '',
        redirectTo: '/app/tabs/schedule',
        pathMatch: 'full',
      },
    ],
  },
];
