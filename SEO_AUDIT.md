# SEO Audit — Fix 404s, canonical www/non-www, pages thin

**Branche** : `seo/fix-404-canonical`
**Date** : 5 mai 2026
**Auteur** : Cabot
**Statut** : modifications prêtes, à valider en preview puis merger

---

## TL;DR

3 problèmes techniques majeurs identifiés, 2 fixés sur cette branche, 1 nécessite ton input :

1. ✅ **Canonisation www côté infra** : ajout `vercel.json` avec redirect 301 host-based `noctaparis.fr` → `www.noctaparis.fr`. Élimine la duplication GSC.
2. ✅ **9 redirects historiques rendus en 301 HTTP réels** : migrés d'`astro.config.mjs` (qui produisait des `<meta refresh>` client-side) vers `vercel.json`. Probable cause des "2 pages avec redirection en échec" GSC.
3. ⚠️ **9 URLs 404 GSC** : `vercel.json` prêt à recevoir les mappings. Action requise : exporter le CSV GSC.

Bonus : audit thin content + alerte build incrémental local (sans incidence prod).

---

## 1. Audit des routes existantes

### 1.1 Inventaire généré par Astro

Total **31 pages buildées** depuis `src/pages/` :

| Type | Fichier source | Routes générées |
|---|---|---|
| Statique | `index.astro` | `/` |
| Statique | `maison.astro` | `/maison` |
| Statique | `contact.astro` | `/contact` |
| Statique | `merci.astro` | `/merci` (filtré sitemap) |
| Statique | `mentions-legales.astro` | `/mentions-legales` (filtré sitemap) |
| Statique | `404.astro` | `/404` |
| Statique | `journal.astro` | `/journal` (hub) |
| Statique | `traiteur/index.astro` | `/traiteur` (hub) |
| Statique | `prestations/index.astro` | `/prestations` |
| Statique | `prestations/{private,corporate,signature}.astro` | 3 sous-pages |
| Dynamique | `journal/[slug].astro` | 8 articles (1/.md dans `src/content/journal/`) |
| Dynamique | `traiteur/[slug].astro` | 10 GEO (1/.md dans `src/content/geo/`) |
| Privé | `commande/boucheron.astro` | gated `?key=` (filtré sitemap) |

### 1.2 Sitemap — état post-rebuild propre

`dist/sitemap-0.xml` contient **27 URLs** (31 pages – 4 filtrées : merci, mentions-legales, 404, commande/boucheron). Toutes sans trailing slash, alignées avec `astro.config.mjs:trailingSlash:'never'`. Cohérence ✓.

### 1.3 ⚠️ Anomalie locale détectée

Un `npm run build` initial sur cette session a produit **seulement 12 pages** (il manquait toutes les `[slug]` dynamiques). Sitemap de 9 URLs au lieu de 27. Reproduit après `rm -rf dist .astro node_modules/.astro` : tout est revenu normal (31 pages).

Diagnostic : cache Astro corrompu localement (probablement après nos clean-builds successifs des sprints précédents). **Sans incidence prod** — Vercel rebuild from scratch à chaque deploy. À surveiller cependant côté CI/cron auto si jamais une build incrémentale est utilisée.

**Action** : si le sitemap en prod (`https://www.noctaparis.fr/sitemap-0.xml`) n'a pas tes ~27 URLs aujourd'hui, c'est probablement la **cause primaire de la chute SEO** — Google ne voit plus tes pages GEO et articles. À vérifier en premier (curl le sitemap prod, compare).

---

## 2. Configuration canonique www/non-www

### 2.1 État actuel (avant cette branche)

| Élément | Valeur |
|---|---|
| `astro.config.mjs:site` | `https://www.noctaparis.fr` ✓ |
| `<link rel="canonical">` (layout.astro:60) | dérive de `Astro.site`, donc www ✓ |
| `<meta property="og:url">` (layout.astro:48) | dérive de `Astro.site`, donc www ✓ |
| JSON-LD `CateringService.url` | `https://www.noctaparis.fr` ✓ |
| `robots.txt` Sitemap | `https://www.noctaparis.fr/sitemap-index.xml` ✓ |
| **Vercel : redirect noctaparis.fr → www** | ❌ **manquant** (cause du dédoublement GSC) |

### 2.2 Recommandation : garder www comme canonique

Choix retenu : **www** (status quo).

| Critère | www (retenu) | non-www |
|---|---|---|
| Code à modifier | 0 référence | ~30 strings codées en dur (canonical, og:url, JSON-LD, robots.txt, sitemap) |
| Backlinks externes | Préservés | Indirectement perdus jusqu'au prochain crawl Google |
| Risque SEO transitoire | Aucun | Position moyenne potentiellement impactée pendant semaines |
| Tendance moderne | Vieux mais stable | Plus contemporain |

Vu la chute SEO -50% / -81% en cours, **minimiser les changements de surface** = maximiser le ROI du fix. Si tu préfères migrer vers non-www, c'est faisable mais c'est un autre sprint plus lourd.

### 2.3 Fix appliqué : `vercel.json`

Nouveau fichier `vercel.json` à la racine, avec :

```json
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "noctaparis.fr" }],
  "destination": "https://www.noctaparis.fr/:path*",
  "permanent": true
}
```

Tout trafic `https://noctaparis.fr/<X>` est désormais redirigé en **301 HTTP** vers `https://www.noctaparis.fr/<X>`. Vercel évalue les `redirects` avant le file matching, donc ça intercepte tous les paths.

**Note** : Vercel a aussi un paramètre "Primary Domain" dans le dashboard. Le redirect dans `vercel.json` est explicite et garantit le comportement même si quelqu'un change le setting dashboard par erreur.

---

## 3. Redirections 301 pour les 404 GSC

### 3.1 Migration des 9 redirects historiques (Astro → Vercel)

Avant cette branche, [`astro.config.mjs`](astro.config.mjs) contenait 9 entrées `redirects:`. **Problème** : Astro génère ces redirects comme des fichiers HTML avec `<meta http-equiv="refresh">`, ce qui constitue une redirection **client-side faible** que Google peut flag comme "Page avec redirection" en échec.

**Fix** : déplacés vers `vercel.json` pour devenir de vrais **301 HTTP serveur**.

| Source | Destination | Type |
|---|---|---|
| `/events` | `/prestations` | 301 |
| `/events/diner-prive-saint-tropez` | `/prestations/private` | 301 |
| `/nocta-signature` | `/prestations/signature` | 301 |
| `/nocta-corporate` | `/prestations/corporate` | 301 |
| `/nocta-private` | `/prestations/private` | 301 |
| `/demande-de-devis` | `/contact` | 301 |
| `/blog` | `/journal` | 301 |
| `/blog/:slug*` | `/journal/:slug*` | 301 (nouveau — wildcard préventif) |
| `/journal/traiteur-la-defense.md` | `/journal/traiteur-la-defense` | 301 |
| `/mention-legal` | `/mentions-legales` | 301 |

`astro.config.mjs` nettoyé : bloc `redirects:` retiré, commentaire ajouté pour expliquer pourquoi.

### 3.2 Hypothèse forte sur les 2 pages "Page avec redirection" GSC

Très probablement 2 des 9 ci-dessus que Google avait flag à cause du meta-refresh. **Le fix devrait les résoudre automatiquement après recrawl** (1-3 semaines).

### 3.3 9 × 404 GSC mappés (post-export CSV)

L'export CSV GSC a remonté 9 URLs en "Introuvable". Croisé avec les redirects historiques déjà migrés depuis `astro.config.mjs`, on a **7 doublons** (déjà couverts) et **2 vraiment nouveaux** :

| Source 404 GSC | Destination | Statut | Justification |
|---|---|---|---|
| `/events/biologique-recherche-livraison-dejeuner-pause-gourmande` | `/journal/buffet-entreprise-paris-livraison-hebdomadaire` | ✅ ajouté | Ancienne page client → article qui couvre la même collaboration (Biologique Recherche, livraisons hebdomadaires) |
| `/a-propos` | `/maison` | ✅ ajouté | Renommage slug : "À propos" → "Notre Maison" |
| `/nocta-corporate` | `/prestations/corporate` | ✓ déjà L. 14 | Refonte structure (route à plat → sous-route prestations) |
| `/nocta-signature` | `/prestations/signature` | ✓ déjà L. 13 | Idem |
| `/nocta-private` | `/prestations/private` | ✓ déjà L. 15 | Idem |
| `/events` | `/prestations` | ✓ déjà L. 11 | "Événements" merged sous "Prestations" |
| `/journal/traiteur-la-defense.md` | `/journal/traiteur-la-defense` | ✓ déjà L. 19 | Index Google historique — extension `.md` exposée à une époque |
| `/demande-de-devis` | `/contact` | ✓ déjà L. 16 | Renommage slug |
| `/blog` | `/journal` | ✓ déjà L. 17 | Renommage slug |

Total après ce sprint : **12 redirects 301 actifs** dans `vercel.json` (10 historiques + 2 GSC).

### 3.4 Liens `.md` cassés trouvés et corrigés

**Aucun lien `.md` cassé trouvé dans `src/`.** Sweep effectué :

```bash
grep -rn "href=.*\.md" src/ --include="*.{astro,mdx,md,ts,tsx,jsx,js}"
grep -rn "\.md[\"'\\)]" src/
grep -rn "\\]\\([^)]*\\.md" src/content/
```

Résultats :
- `src/pages/journal.astro:39` — `href={\`/journal/${article.id.replace(/\.md$/, '')}\`}` → **protection défensive** (suppression du suffixe avant href)
- `src/pages/journal/[slug].astro:89` — idem dans le bloc related-articles
- `src/pages/traiteur/[slug].astro:6` — commentaire JSDoc mentionnant `src/content/geo/*.md` (pas un href)
- `astro.config.mjs:12` — commentaire mentionnant `SEO_AUDIT.md` (le rapport lui-même)

**Conclusion** : pas de bug interne. Le 404 sur `/journal/traiteur-la-defense.md` vient de l'index Google historique (URL exposée avant migration des content collections vers les slug propres). Le redirect L. 19 le résout. Resoumettre le sitemap dans GSC accélérera le re-crawl.

**Sitemap généré** : `dist/sitemap-0.xml` contient **0** URL avec extension `.md` (vérifié `grep -c '\.md<' dist/sitemap-0.xml` → 0). ✓

---

## 4. Audit pages "thin content"

### 4.1 Compte de mots par page (corps textuel, scripts/CSS/header/footer exclus)

| Page | Mots | Risque |
|---|---|---|
| `/` | 374 | OK |
| `/maison` | 346 | OK |
| `/contact` | **98** | 🔴 **Très thin** |
| `/journal` | 409 | OK |
| `/prestations` | 376 | OK |
| `/prestations/private` | 223 | 🟡 borderline |
| `/prestations/corporate` | 422 | OK |
| `/prestations/signature` | 215 | 🟡 borderline |
| `/traiteur` | **124** | 🟡 thin (hub list, peu de prose) |
| `/404` | 21 | (filtré sitemap — non indexable) |
| `/merci` | 20 | (Disallow robots — non indexable) |
| `/mentions-legales` | 174 | (Disallow robots — non indexable) |

### 4.2 Hypothèse sur les 2 pages "Explorée non indexée" GSC

Hypothèse : `/contact` et probablement `/traiteur` (hub).

| Page | Reco |
|---|---|
| `/contact` | **Enrichir** : ajouter 200-300 mots avant/après le formulaire (contexte "comment on travaille", "à quoi s'attendre dans les 48h", "que préparer pour la 1ère réponse"). Cible ~350 mots. |
| `/traiteur` | **Enrichir l'intro** : actuellement juste un eyebrow + h1 + 1 paragraphe → étendre à 3-4 paragraphes (logique de maillage géo, pourquoi Paris+92, organisation par type). Alternative : `noindex` si on veut le garder comme hub utilitaire pure. |
| `/prestations/private` | À surveiller : enrichir au prochain sprint éditorial avec des cas concrets (formats à 6 / 12 / 20 couverts, exemples menus). |
| `/prestations/signature` | Idem : ajouter description plus concrète des collaborations passées. |

**Pas de fix appliqué dans cette branche** : changements éditoriaux à scoper séparément (pas de Cabot qui rédige seul).

---

## 5. Vérification du sitemap

| Check | État |
|---|---|
| Filtre `merci`, `mentions-legales`, `commande/` | ✓ ([astro.config.mjs:14](astro.config.mjs)) |
| 404 absent du sitemap | ✓ |
| Trailing slash cohérent (toutes sans) | ✓ (`trailingSlash: 'never'`) |
| URLs sitemap → 200 direct (pas de redirect) | ✓ post-rebuild |
| URLs `noindex` absentes | ✓ |
| Pointer dans `robots.txt` correct | ✓ |

---

## Fichiers modifiés (cette branche)

| Fichier | Action | Raison |
|---|---|---|
| `vercel.json` | **Créé** | Canonisation host www + 10 redirects 301 réels |
| `astro.config.mjs` | Nettoyé | Bloc `redirects:` retiré (déplacé vers Vercel) |
| `SEO_AUDIT.md` | **Créé** | Ce rapport |

Aucun changement sur le contenu éditorial, le layout, le formulaire Contact, GTM, ou Formspree.

---

## Actions restantes Enzo

### Bloquantes (avant merge)
1. **Vérifier le sitemap prod** : `curl -s https://www.noctaparis.fr/sitemap-0.xml | grep -c '<loc>'` → si != ~27, alerte critique. Probablement la cause #1 de la chute SEO.
2. **Tester preview local** : `npm run preview` puis :
   - Vérifier `http://localhost:4321/blog` → redirige vers `/journal` ?
     ⚠️ Note : `vercel.json` n'est appliqué qu'en prod Vercel, **pas** en preview local Astro. La preview locale ne testera donc PAS les redirects vercel.json — seul le déploiement Vercel le fera. Pour tester localement, déployer la branche en preview Vercel.
3. **Décision www vs non-www** : valider la reco www (status quo) ou demander la bascule non-www.

### À fournir (pour fermer le ticket)
4. ~~Export CSV GSC des 9 URLs 404~~ ✅ **Fait** : 9 mappings consolidés dans `vercel.json` (7 doublons des redirects historiques, 2 nouveaux ajoutés). Cf. §3.3.
5. **Export CSV GSC des 2 "Explorée non indexée"** : valider mon hypothèse `/contact` + `/traiteur` ou identifier les vraies pages.

### Optionnelles (sprints suivants)
6. **Enrichir `/contact`** (200+ mots de contexte) et `/traiteur` (3-4 paragraphes intro).
7. **Surveiller le déploiement Vercel** : après merge de cette branche, vérifier dans `https://noctaparis.fr/maison` (sans www) qu'on est redirigé en 301 vers `https://www.noctaparis.fr/maison`. Idem pour `/blog/quelconque`, `/nocta-private`, etc.
8. **Resoumettre le sitemap dans GSC** après deploy pour accélérer le recrawl.

---

## Diagnostic le plus probable de la chute SEO

Hypothèses ordonnées par probabilité :

1. **Sitemap prod incomplet** (à vérifier — point 1 ci-dessus). Si Google ne voit que 9 URLs au lieu de 27, c'est mécaniquement une perte massive d'impressions.
2. **Duplication www/non-www** : Google répartit le SEO entre les deux versions, dilution. Fixé par `vercel.json`.
3. **Meta-refresh redirects** flag par Google comme faibles. Fixé par migration vers vrais 301.
4. **Pages thin** (`/contact`, `/traiteur`) ne se classent pas. À traiter sprint éditorial.

Le fix infra (cette branche) adresse 2/3/partie 4. Le 1 nécessite ta vérif manuelle prod.
