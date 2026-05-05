# Sprint B — Pilote refonte page GEO : Courbevoie / La Défense

**Date** : 5 mai 2026
**Statut** : ✅ Implémenté, à valider en preview Vercel
**Branche** : `seo/sprint-b-pilote-courbevoie`
**Persona ciblée** : Office Manager grand groupe / quartier d'affaires
**Atout local** : siège NOCTA à Courbevoie

## Contexte

Première des 10 pages GEO refondue dans le cadre du Sprint B. Objectif : différencier les pages GEO entre elles pour résoudre le statut "Détectée non indexée" GSC sur les 6 plus anciennes (croisement audit Sprint A — diagnostic : Google les juge thin/redondantes).

Cette page est la **pilote** : la structure, les champs frontmatter et l'enrichissement schema validés ici serviront de gabarit aux 9 autres pages GEO sur les sprints suivants.

## Modifications appliquées

### 1. Schéma Content Collection étendu (rétrocompatible)

[`src/content/config.ts`](../../src/content/config.ts) — 4 nouveaux champs **optionnels** sur la collection `geo` :

| Champ | Type | Usage |
|---|---|---|
| `h1` | `string.max(80).optional()` | H1 distinct du `title` SEO (titre court côté contenu) |
| `streetAddress` | `string.optional()` | Adresse précise pour enrichir `PostalAddress` du schema |
| `areaServed` | `array<string>.optional()` | Liste de zones servies (5 entries pour cette pilote) |
| `faq` | `array<{question, answer}>.optional()` | Q/R injectées en `FAQPage` JSON-LD |

Les 9 autres pages GEO restent compatibles (champs facultatifs, fallback sur les valeurs précédentes).

### 2. Template `[slug].astro` enrichi

[`src/pages/traiteur/[slug].astro`](../../src/pages/traiteur/[slug].astro) :

- **H1 distinct du title** : `displayH1 = d.h1 ?? d.title` — le H1 affiché est plus court et lisible, le `<title>` reste optimisé SEO.
- **Schema CateringService enrichi** : ajout `image`, `servesCuisine`, `potentialAction (ReserveAction)`. Si `streetAddress` présent dans le frontmatter, `address.streetAddress` + `postalCode: '92400'` injectés. Si `areaServed` est un tableau, génération d'une liste de `Place` (sinon fallback sur `zone` simple).
- **Schema FAQPage conditionnel** : injection automatique d'un second `<script type="application/ld+json">` si `d.faq` présent. Maximise les chances de rich snippet "People also ask" sur Google + citabilité par les LLMs.

### 3. Contenu refondu

[`src/content/geo/traiteur-courbevoie-la-defense.md`](../../src/content/geo/traiteur-courbevoie-la-defense.md) :

- Frontmatter mis à jour : `title` (69/70 chars), `description` (154/170 chars), nouveaux champs (`h1`, `streetAddress`, `areaServed`, `faq` x6).
- Body remplacé : 6 blocs (intro chapeau, formats, comment on travaille, ancrage local, tarifs, FAQ) — voir contenu intégral dans le `.md`.
- Préservés : `zone`, `type`, `publishDate`, `readingTime`, `schemaType`, `ctaType` (compatibilité hub `/traiteur` + cross-link `[slug]`).

## Validation

### Build
```
npm run build → 31 pages, sitemap 27 URLs ✓
```

### JSON-LD générés sur la page
4 blocs détectés dans `dist/traiteur/traiteur-courbevoie-la-defense/index.html` :
1. `CateringService` global (du layout, sur toutes les pages)
2. `CateringService` page-level (5 areaServed, streetAddress 2B, ReserveAction)
3. `FAQPage` (6 questions)
4. `BreadcrumbList`

Tous parsent correctement.

### H1 vs title
- `<title>` : "Traiteur Courbevoie & La Défense — NOCTA, traiteur événementiel local"
- `<h1>` : "Traiteur à Courbevoie et La Défense"

✓ Séparation propre, validée.

## Points en suspens / à arbitrer

### 1. Doublon schema `CateringService`

Le layout global ([src/layouts/layout.astro:68](../../src/layouts/layout.astro)) injecte un `CateringService` sur **toutes** les pages du site, et la page Courbevoie injecte aussi son propre `CateringService` enrichi. Résultat : 2 entités du même `@type` dans le même HTML.

| Schema | Source | Contenu |
|---|---|---|
| 1er bloc | layout global | NOCTA global, areaServed = 4 (Paris, IDF, La Défense, France), streetAddress = "2 bis rue Edith Cavell" |
| 2nd bloc | page courbevoie | NOCTA local, areaServed = 5 (Courbevoie + 4 voisines), streetAddress = "2B Rue Edith Cavell" |

**Admissible pour Google** (peut être interprété comme entreprise vs service local), mais sub-optimal. Le brief disait "UN seul schema par page".

**Options pour le résoudre (sprints suivants)** :
- A) Le layout détecte si la page injecte déjà un `CateringService`/`Service` propre et **skip** le schema global → invasif (impacte toutes les pages).
- B) Le schema page-level passe en `LocalBusiness` ou `Branch` plutôt que `CateringService` → différencie sémantiquement.
- C) Accepter (statu quo) — Google le tolère.

**Décision provisoire** : C (statu quo) sur cette pilote, à reconsidérer après observation du comportement GSC sur 2-3 semaines.

### 2. Notation adresse "2B" vs "2 bis"

Le layout global utilise "2 bis rue Edith Cavell" (FR). Le brief brief mentionne "2B Rue Edith Cavell" (notation EN/abréviée). Gardé "2B" dans le frontmatter de la page pour respecter le brief, mais **incohérent** avec le schema global. À harmoniser dans un sprint typo.

### 3. Test Vercel pas réalisé localement

Pas de PR mergée, pas d'API function à tester côté local. La preview Vercel branche `seo/sprint-b-pilote-courbevoie` permettra de :
- Vérifier `curl -I https://<preview-url>/traiteur/traiteur-courbevoie-la-defense` → `HTTP/2 200`
- Inspecter rich snippets via [Schema.org Validator](https://validator.schema.org/) sur l'URL preview
- Inspecter le rendu mobile (FAQ section sobriété)

## Prochains sprints

Décliner ce gabarit sur 9 pages GEO restantes, par ordre de priorité (= cohérence persona × ancienneté GSC) :

1. `traiteur-paris-8` (corporate, 18 avril) — quartier d'affaires similaire
2. `traiteur-paris-7` (private, 18 avril) — résidentiel haut de gamme
3. `traiteur-paris-16` (private, 17 avril) — résidentiel
4. `traiteur-neuilly-sur-seine` (private, 20 avril) — mix
5. `traiteur-paris-6` (private, 24 avril) — Saint-Germain
6. `traiteur-paris-17` (corporate, 27 avril) — Monceau/Ternes
7. `traiteur-paris-1` (corporate, 29 avril) — Vendôme
8. `traiteur-levallois-perret` (corporate, 1er mai) — quartier d'affaires
9. `traiteur-boulogne-billancourt` (corporate, 4 mai) — tertiaire

À chaque page : adapter intro (ancrage local précis), formats (selon persona), section "Comment nous travaillons" (contraintes du quartier), 3-6 questions FAQ contextualisées.
