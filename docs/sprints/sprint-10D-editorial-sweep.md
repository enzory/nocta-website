# Sprint 10D — Sweep éditorial brand voice

**Date** : 4 mai 2026
**Statut** : ✅ Bouclé
**Commit final** : `fecab06`
**Build** : 30 pages OK

## Contexte

Nettoyage éditorial des pages publiques pour aligner la voix avec les règles brand NOCTA :
- Éliminer les mots bannis (`haut de gamme`, `sur-mesure`, `d'exception`, `prestige`, etc.)
- Préserver les citations clients fidèles (règle d'or)
- Maintenir la cohérence H1, H3, meta tags, alt images, JSON-LD

**Scope** : 6 fichiers — `index.astro`, `prestations/index.astro`, `prestations/private.astro`, `prestations/corporate.astro`, `prestations/signature.astro`, `maison.astro`

**Hors scope** : articles Journal (`src/content/journal/*.md`) — dette identifiée pour Sprint 11+

## Décisions tranchées

### Cas 14 — Citation Valérie Dugard (corporate.astro:208)
**NON MODIFIÉE.** Règle d'or "citations fidèles" prime. La citation contient `clientèle haut de gamme` et `présentation impeccable` mais c'est la voix de la cliente, pas de NOCTA.

### Cas 21 — Bio Enzo (maison.astro:53)
**Final : "haute gastronomie"** (commit fecab06).
Justification : alignement avec JSON-LD jobTitle ("haute gastronomie étoilée") et bio détaillée ligne 123.

### Cas 9 — H3 "Anniversaire" (private.astro:101)
**Validé tel quel.** Cohérence avec les 3 H3 voisins de la grille (Dîner privé, Célébration familiale, Chef à domicile).

## Modifications appliquées

20 modifs effectives, 1 préservée (citation Dugard). Détail complet dans la page Notion : https://www.notion.so/356825f8b3818108804bdf197d16dd5e

## Cas en suspens

- **Whitelist `<blockquote>` dans `seo-brand-check.mjs`** : à traiter (immédiat ou Sprint 11)
- **Articles Journal** : dette de 25 `haut de gamme` + 7 `prestige` + 3 `d'exception` à traiter en Sprint 11+

## Commits

| Étape | Commit |
|---|---|
| Sweep initial Cabot | `bacc417` |
| Inversion cas 21 | `d2f713c` (rebasé) |
| Push final | **`fecab06`** |
