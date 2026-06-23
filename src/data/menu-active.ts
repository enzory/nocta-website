// Résout la semaine active dans la rotation 4 semaines et l'expose sous la
// forme plate attendue par tous les consommateurs (MenuSemaine, Configurateur,
// ConditionsPlateaux, JSON-LD).
//
// La résolution se fait au build : `new Date()` à la génération Astro.
// Un build Vercel = un snapshot. Tant que personne ne push pendant > 7 jours,
// la rotation reste cohérente. Pour une rotation strictement calendaire au jour
// près, déclencher un rebuild hebdo via cron Vercel.

import raw from './menu-semaine.json';

export type MenuItem = {
  id: string;
  nom: string;
  description: string;
  image: string;
  tags?: string[];
  allergenes?: string[];
};

type Week = {
  numero: number;
  label: string;
  entrees: MenuItem[];
  plats: MenuItem[];
  desserts: MenuItem[];
};

type Tarifs = {
  entree: number;
  plat: number;
  dessert: number;
  livraison_paris: number;
  minimum_commande: number;
};

type Raw = {
  rotation: { date_debut: string; duree_semaines: number };
  semaines: Week[];
  tarifs: Tarifs;
};

const data = raw as Raw;

/** Index 0…(N-1) de la semaine active, basé sur le nombre de semaines écoulées
 * depuis `rotation.date_debut`. Avant la date de début → semaine 0. */
export function activeWeekIndex(today: Date = new Date()): number {
  const start = new Date(data.rotation.date_debut + 'T00:00:00');
  const diffMs = today.getTime() - start.getTime();
  const weeksSince = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const n = data.rotation.duree_semaines;
  if (weeksSince < 0) return 0;
  return ((weeksSince % n) + n) % n;
}

/** Lundi 00:00 de la semaine contenant `d`. Lundi = premier jour ISO. */
function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7; // 0=lundi, 6=dimanche
  r.setDate(r.getDate() - day);
  return r;
}

const FR_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function frenchDate(d: Date): string {
  return FR_DATE.format(d);
}

const now = new Date();
const idx = activeWeekIndex(now);
const week = data.semaines[idx];
const monday = mondayOf(now);

/** Menu projeté : forme plate compatible avec les consommateurs existants. */
export const activeMenu = {
  semaine: {
    numero: week.numero,
    label: `Semaine du ${frenchDate(monday)}`,
    debut: monday.toISOString().slice(0, 10),
    rotationIndex: idx,
    rotationLength: data.rotation.duree_semaines,
  },
  entrees: week.entrees,
  plats: week.plats,
  desserts: week.desserts,
  tarifs: data.tarifs,
};

export type ActiveMenu = typeof activeMenu;
