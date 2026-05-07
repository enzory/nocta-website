# Données du module Plateaux Repas

## menu-semaine.json

Source unique du menu hebdomadaire affiché sur `/plateaux-repas` (page publique
+ configurateur de commande). Le fichier est lu côté serveur par Astro à chaque
build : il faut donc redéployer après modification (push sur `main` → Vercel).

### Format

```jsonc
{
  "semaine": {
    "numero": 19,                       // n° ISO de la semaine
    "debut": "2026-05-04",              // ISO YYYY-MM-DD (lundi)
    "fin":   "2026-05-08",              // ISO YYYY-MM-DD (vendredi)
    "label": "Semaine du 4 mai 2026"    // libellé affiché en titre
  },
  "entrees":  [ /* exactement 2 entrées  */ ],
  "plats":    [ /* exactement 3 plats    */ ],
  "desserts": [ /* exactement 2 desserts */ ],
  "tarifs": {
    "entree":            8,    // € HT par entrée
    "plat":              18,   // € HT par plat
    "dessert":           7,    // € HT par dessert
    "livraison_paris":   20,   // € HT forfait livraison Paris intra-muros
    "minimum_commande":  500   // € HT (Total HT, livraison incluse)
  }
}
```

Chaque item (entrée / plat / dessert) suit la même forme :

```jsonc
{
  "id":          "ent-001",                              // unique, stable
  "nom":         "Salade de carottes, pois chiches…",    // affiché
  "description": "Vinaigrette aux graines de lin…",      // 1–2 lignes
  "image":       "/img/plateaux/carottes-pois-chiches.jpg",
  "tags":        ["végétarien", "sans gluten"],          // libres
  "allergenes":  ["gluten", "lait", "œuf"]               // INCO 1169/2011
}
```

### Édition hebdomadaire (chaque lundi)

1. **Ouvrir** `src/data/menu-semaine.json`.
2. **Mettre à jour** `semaine` (numero, debut, fin, label).
3. **Remplacer** les items par ceux de la nouvelle semaine. Garder 2 / 3 / 2.
4. **Garder les `id` stables** d'une semaine sur l'autre quand un plat revient
   (`pla-001` = même plat sur plusieurs semaines), sinon en créer un nouveau.
   Les `id` ne sont jamais affichés mais servent au configurateur.
5. **Déposer les photos** dans `public/img/plateaux/` et référencer le chemin
   exact dans `image` (commence par `/img/plateaux/…`). Format : carré 1200×1200,
   jpg ou webp, < 200 ko. Si la photo n'est pas prête, utiliser
   `/img/plateaux/placeholder.jpg`.
6. **Ne pas toucher** au bloc `tarifs` sans valider avec Hugo / Enzo.
7. **Commit & push** sur `main` — Vercel redéploie automatiquement.

### Validation rapide

Le JSON doit être valide (pas de virgule traînante). Pour vérifier :

```bash
node -e "JSON.parse(require('fs').readFileSync('src/data/menu-semaine.json','utf8'))"
```

Pas de sortie = OK.

### Roadmap

À terme (v2), ce fichier sera édité via Decap CMS pour permettre une édition
sans passer par git. En attendant, l'édition manuelle reste la seule voie.
