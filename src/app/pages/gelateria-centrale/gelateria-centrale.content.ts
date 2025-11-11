export type GcHour = { days: string; time: string };
export type GcImage = { src: string; alt: string };

export interface GcContent {
  siteName: string;
  tagline: string;

  // hero & brand
  heroImage: string;                   // se vuota, resta tinta
  logoImage?: string;                  // nuovo: logo da mostrare nel hero
  navLabels: { storia: string; presente: string; servizi: string };

  // STORIA
  storyHeadline: string;
  storyImage: string;
  storyHtml: string;

  // PRESENTE
  presentTitle: string;
  presentHtml: string;
  presentImages: GcImage[];

  // SERVIZI
  servicesTitle: string;               // es. "I NOSTRI SERVIZI?"
  servicesSubheadline: string;         // es. "UN CONCENTRATO DI GUSTO, ..."
  creationsImage?: string;             // nuovo: banner “Alcune delle nostre creazioni”
  servicesHtml: string;

  // opzionale (resto pagina)
  address?: string;
  phone?: string;
  hoursTitle?: string;
  hours?: GcHour[];
}

export const GC_DEFAULT_CONTENT: GcContent = {
  siteName: 'Gelateria Centrale',
  tagline: 'Gran Caffè • Gelateria • Pasticceria • Aperitivi',

  heroImage: 'assets/gelateria-centrale/hero.jpg',
  logoImage: 'assets/gelateria-centrale/logo-centrale.jpg',
  navLabels: {
    storia: 'LA STORIA',
    presente: 'IL PRESENTE',
    servizi: 'I NOSTRI SERVIZI',
  },

  // === LA STORIA =====================================================
  storyHeadline: 'UNA STORIA INFINITA.',
  storyImage: 'assets/gelateria-centrale/storia-1.jpg',
  storyHtml: `
    <p><strong>Tullio</strong> e <strong>Dina</strong>, complici nella vita e nel lavoro da quasi
    60 anni, sono stati e sono il <strong>cuore pulsante del Gran Caffè Gelateria Centrale</strong>.</p>
    <p>Con passione, sacrificio e amore, hanno costruito giorno dopo giorno il sogno di una vita.</p>
    <p><strong>Maestri di accoglienza, ma soprattutto di umanità.</strong></p>
  `,

  // === IL PRESENTE ===================================================
  presentTitle: 'IL PRESENTE',
  presentHtml: `
    <p><em>Da generazioni.</em></p>
    <p>Al Gran Caffè il testimone è passato con amore e dedizione a <strong>Morena</strong> e
    <strong>Roberta</strong>, due sorelle, due anime diverse, ma unite dallo stesso spirito di famiglia.</p>

    <p><strong>Morena</strong>, esperta di cocktail e caffetteria, vi accoglie ogni giorno con creazioni
    personalizzate, cappuccini cremosi e confezioni regalo pensate con il cuore. Una vera artista del bancone,
    sempre pronta a stupirvi con una novità.</p>

    <p><strong>Roberta</strong>, invece, è la regina del food: gelati artigianali, dolci fatti in casa,
    torte e aperitivi gourmet portano la sua firma. Un talento innato, arricchito da studio, passione e creatività.</p>
  `,
  presentImages: [
    { src: 'assets/gelateria-centrale/presente-morena.jpg',  alt: 'Morena – cocktail & caffetteria' },
    { src: 'assets/gelateria-centrale/presente-interno.jpg', alt: 'Interno del locale' },
    { src: 'assets/gelateria-centrale/presente-roberta.jpg', alt: 'Roberta – gelato & pasticceria' },
  ],

  // === SERVIZI =======================================================
  servicesTitle: 'I NOSTRI SERVIZI',
  servicesSubheadline: 'UN CONCENTRATO DI GUSTO, CREATIVITÀ E ACCOGLIENZA.',
  creationsImage: 'assets/gelateria-centrale/alcune-creazioni.png',
  servicesHtml: `
    <h4>Gelateria Artigianale</h4>
    <p>Coni fragranti, coppette di ogni dimensione, brioche e waffle da sogno, coppe scenografiche in vetro e vaschette d’asporto per portare la dolcezza a casa. Ogni gusto è una coccola, ogni scelta un’esperienza.</p>

    <h4>Caffetteria e colazioni con cuore</h4>
    <p>Dal classico espresso che ti risveglia al cappuccino con disegni di schiuma, fino a bevande personalizzate che parlano di te. Un angolo dove il profumo di caffè incontra la fantasia, brioche o crostatina incluse!</p>

    <h4>Apericena & Feste</h4>
    <p>Organizza il tuo compleanno o una serata speciale con i nostri aperitivi cena: piatti preparati con cura, gusto e un pizzico di magia. Ideale per chi vuole rilassarsi… con gusto.</p>

    <h4>Cocktail su misura</h4>
    <p>Drink classici o creazioni del momento: lasciati sorprendere dalla nostra selezione o chiedi un cocktail fatto apposta per te, perché ogni sorso racconti una storia.</p>

    <h4>Tè, tisane e trend beverage</h4>
    <p>Per gli amanti delle alternative: tè caldi, infusi profumati, bibite fresche, healthy drinks e le novità più in voga. La scelta perfetta a ogni ora del giorno.</p>
  `,
};
