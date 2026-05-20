# Données du module Plateaux Repas

## menu-semaine.json

Source unique du menu affiché sur `/plateaux-repas` (page publique + configurateur).
Lu côté serveur par Astro à chaque build → **redéployer après modification**
(push → Vercel rebuild automatique).

La résolution de la semaine active dans la rotation est faite par
`src/data/menu-active.ts` (helper TS). Les composants importent `activeMenu`,
pas le JSON brut.

## Modèle : rotation N semaines

Le menu n'est plus une semaine isolée mais un **cycle de plusieurs semaines**
(4 par défaut) qui tourne automatiquement.

```jsonc
{
  "rotation": {
    "date_debut":      "2026-05-11",   // ISO YYYY-MM-DD (lundi de la S1)
    "duree_semaines":  4               // longueur du cycle
  },
  "semaines": [
    { "numero": 1, "label": "Semaine 1", "entrees": [3], "plats": [3], "desserts": [3] },
    { "numero": 2, "label": "Semaine 2", "entrees": [3], "plats": [3], "desserts": [3] },
    { "numero": 3, "label": "Semaine 3", "entrees": [3], "plats": [3], "desserts": [3] },
    { "numero": 4, "label": "Semaine 4", "entrees": [3], "plats": [3], "desserts": [3] }
  ],
  "tarifs": {
    "entree":            8,    // € HT par entrée
    "plat":              18,   // € HT par plat
    "dessert":           7,    // € HT par dessert
    "livraison_paris":   20,   // € HT forfait livraison Paris intra-muros
    "minimum_commande":  195   // € HT (Total HT, livraison incluse)
  }
}
```

Chaque item (entrée / plat / dessert) suit la même forme :

```jsonc
{
  "id":          "s1-ent-001",                            // unique, stable
  "nom":         "Salade de carottes, pois chiches…",     // affiché
  "description": "Vinaigrette aux graines de lin…",       // 1–2 lignes
  "image":       "/img/plateaux/carottes-pois-chiches.jpg",
  "tags":        ["végétarien", "sans gluten"],           // libres
  "allergenes":  ["gluten", "lait", "œuf"]                // INCO 1169/2011
}
```

Convention `id` : `s{N°semaine}-{cat}-{numéro}` (ex. `s2-pla-003`). Important :
ne pas réutiliser un id d'une semaine à l'autre — le configurateur s'appuie
dessus pour identifier la sélection.

### Calcul de la semaine active

Au build, `menu-active.ts` :

1. Lit `rotation.date_debut` et `rotation.duree_semaines`.
2. Compte les semaines écoulées depuis `date_debut` (à 00:00).
3. Modulo `duree_semaines` → index 0 à N-1.
4. Renvoie `semaines[index]` projeté en `{ semaine, entrees, plats, desserts, tarifs }`.

Le titre affiché est **"Menu de la semaine du <lundi en cours>"** — la date est
recalculée à chaque build à partir d'aujourd'hui, pas du label de la rotation.

## Opérations courantes

### Éditer une semaine donnée

Touchez uniquement les items du bloc `semaines[i]`. Les autres semaines, la
rotation et les tarifs ne bougent pas. Commit + push → la prochaine fois que
cette semaine sera active, les nouveaux contenus s'afficheront.

### Décaler le cycle (ex. rotation glissée d'une semaine)

Modifiez `rotation.date_debut` (à un lundi). C'est suffisant.

### Ajouter une 5e semaine

1. Append d'une entrée au tableau `semaines` (numero: 5, label: "Semaine 5",
   3 entrées / 3 plats / 3 desserts avec ids `s5-…`).
2. Incrémenter `rotation.duree_semaines` à 5.
3. Commit + push.

### Retirer une semaine

Inverse de l'ajout. Penser à vérifier qu'aucun id de la semaine retirée n'est
référencé ailleurs (en pratique : non, le configurateur travaille seulement
sur la semaine active).

### Changer les tarifs

Bloc `tarifs`. Le `minimum_commande` se propage automatiquement à :
— la copie du configurateur ("Minimum de commande : X € HT")
— le bandeau Conditions
— le JSON-LD de la page

### Changement de saison (≈ tous les 3 mois)

Refondre les 4 semaines en bloc : nouvelles entrées, plats, desserts, photos.
C'est l'occasion de remettre les `id` à plat (s1-… s2-… etc.).

## Validation rapide

Avant push, valider le JSON :

```bash
node -e "JSON.parse(require('fs').readFileSync('src/data/menu-semaine.json','utf8'))"
```

Pas de sortie = OK.

Puis vérifier le build complet :

```bash
npm run build
```

## Photos

Format attendu : carré 1200×1200, jpg ou webp, < 200 ko. Déposer dans
`public/img/plateaux/` et référencer le chemin exact dans `image`
(`/img/plateaux/…`). Si une photo manque, mettre `/img/plateaux/placeholder.jpg`
— le composant Menu utilise déjà ce fallback via `onerror`.

## Roadmap

À terme (v2), édition via Decap CMS pour sortir du workflow git. En attendant,
l'édition manuelle reste la seule voie.
