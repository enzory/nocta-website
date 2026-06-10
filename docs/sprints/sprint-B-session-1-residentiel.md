# Sprint B Session 1 — 3 GEO résidentielles (Neuilly, Paris 7, Paris 16)

**Date** : 5 mai 2026
**Statut** : ✅ Implémenté, à valider en preview Vercel
**Branche** : `seo/sprint-b-session-1-residentiel`
**Persona ciblée** : clientèle résidentielle (familles, hôtels particuliers, dîners patrimoniaux)

## Contexte

Première vague de déclinaison du gabarit Sprint B (validé sur la pilote Courbevoie). 3 pages refondues sur le persona **clientèle résidentielle**, orienté `ctaType: private` :

| Page | Persona | publishDate (préservé) |
|---|---|---|
| `/traiteur/traiteur-neuilly-sur-seine` | Famille bourgeoise / hôtels particuliers | 2026-04-20 |
| `/traiteur/traiteur-paris-7` | Patrimoine résidentiel premium | 2026-04-18 |
| `/traiteur/traiteur-paris-16` | Familles patrimoniales / dîners élargis | 2026-04-17 |

## Modifications appliquées

3 fichiers `.md` réécrits dans `src/content/geo/` avec :

- **Frontmatter complet** : tous les champs Sprint B (`h1`, `streetAddress`, `areaServed`, `faq`)
- **`publishDate`, `zone`, `type`, `ctaType`, `schemaType` préservés** (pas de touch sur l'identité GSC)
- **Body** : 5-6 sections H2 (intro, formats, approche service, valeur ajoutée locale, tarifs)

### Adaptations par page

| Page | Spécificité éditoriale |
|---|---|
| Neuilly | Bloc 4 en première personne ("j'ai passé quatorze ans en sommellerie") — accords mets-vins comme marque de fabrique |
| Paris 7 | Focus appartement haussmannien + 3 raisons "pourquoi nous choisir" (cuisine adaptée, équipe stable, sommellerie ancrée) |
| Paris 16 | Code "recevoir comme on l'a toujours fait" — Noëls, dîners famille élargie 20-40 couverts, configurations en enfilade |

### Tweaks titre vs limite Zod (`max(70)`)

2 titres du brief dépassaient de 1 char (71/70). Remplacé ` et ` par `, ` (synonyme sobre) :

| Page | Avant (71) | Après |
|---|---|---|
| Neuilly | `Dîners privés et accords mets-vins` | `Dîners privés, accords mets-vins` (69 chars) |
| Paris 7 | `Réceptions privées et dîners en appartement` | `Réceptions privées, dîners en appartement` (68 chars) |

### Frontmatter `areaServed`

| Page | Liste |
|---|---|
| Neuilly | Neuilly-sur-Seine, Levallois-Perret, Courbevoie, Puteaux, Meudon-la-Forêt (5) |
| Paris 7 | Paris 7e, Paris 6e, Paris 15e, Boulogne-Billancourt (4) |
| Paris 16 | Paris 16e, Boulogne-Billancourt, Neuilly-sur-Seine, Paris 17e (4) |

## Validation

```
npm run build : 31 pages OK
sitemap : 27 URLs (stable)
```

JSON-LD inspection :

| Page | CateringService | FAQPage | BreadcrumbList |
|---|---|---|---|
| neuilly | 2 (1 global + 1 page-level) | 1 (6 questions) | 1 |
| paris-7 | 2 | 1 (6 questions) | 1 |
| paris-16 | 2 | 1 (6 questions) | 1 |

**Doublon `CateringService` : connu et adressé.** Le sprint correctif `seo/template-geo-fix` (déjà en PR, pas encore mergé) supprime le schema global sur les routes `/traiteur/*`. Une fois mergé, les 3 pages passeront automatiquement à `CateringService = 1` sans modification de cette branche.

H1 affiché conformément au gabarit (différent du `<title>` SEO long) :
- "Traiteur à Neuilly-sur-Seine"
- "Traiteur à Paris 7e"
- "Traiteur à Paris 16e"

## Reste à décliner (sprints suivants)

| Page GEO | Persona | Statut |
|---|---|---|
| `traiteur-paris-8` | Corporate (galas, sièges) | À faire |
| `traiteur-paris-1` | Corporate (Vendôme, joaillerie) | À faire |
| `traiteur-paris-17` | Corporate (Monceau/Ternes) | À faire |
| `traiteur-paris-6` | Private mixte (Saint-Germain, vernissages) | À faire |
| `traiteur-levallois-perret` | Corporate (tertiaire) | À faire |
| `traiteur-boulogne-billancourt` | Corporate (tertiaire/tech) | À faire |

## Branches en cours

| Branche | Sujet | Statut |
|---|---|---|
| `seo/template-geo-fix` | Doublon CateringService + adresse "2B" | PR ouverte, à merger en priorité |
| `seo/sprint-b-session-1-residentiel` | Cette branche | PR à créer |
