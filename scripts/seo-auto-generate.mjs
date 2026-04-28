#!/usr/bin/env node
/**
 * ============================================================
 * seo-auto-generate.mjs
 * ============================================================
 * Pipeline de génération automatique de pages GEO pour NOCTA.
 *
 * Étapes :
 *   1. Charge src/content/geo-queue.yaml
 *   2. Pioche le premier sujet `pending` (priority DESC)
 *   3. Appelle Claude Sonnet 4.6 avec prompt système NOCTA
 *   4. Lance seo-brand-check.mjs sur le draft
 *   5. Si score >= 8 → écrit dans src/content/geo/ + met status=published
 *   6. Si score < 8 → écrit dans src/content/geo/ + met status=pr-review
 *                     (le workflow GH Actions crée alors une PR au lieu de merger)
 *   7. Persiste la queue mise à jour
 *
 * Variables d'environnement requises :
 *   - ANTHROPIC_API_KEY   (secret GitHub Actions)
 *
 * Sortie JSON sur stdout pour le workflow :
 *   { "status": "published" | "pr-review" | "skipped" | "error",
 *     "slug":   "traiteur-neuilly-sur-seine",
 *     "score":  8.5,
 *     "flags":  [...] }
 * ============================================================
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import Anthropic from "@anthropic-ai/sdk";
import { brandCheck } from "./seo-brand-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const QUEUE_PATH = path.join(ROOT, "src/content/geo-queue.yaml");
const OUTPUT_DIR = path.join(ROOT, "src/content/geo");
const MODEL = "claude-sonnet-4-6";

// ============================================================
// SYSTEM PROMPT — charte éditoriale NOCTA (NON NÉGOCIABLE)
// ============================================================
const SYSTEM_PROMPT = `Tu es le rédacteur interne de NOCTA Catering, traiteur haut de gamme parisien (H+E Catering SARL, basée à Courbevoie, fondée en avril 2025 par Enzo Ryon et Hugo Vinatier).

Clients de référence : Boucheron, Biologique Recherche, The Galion Project, Colombus Consulting, Jus Mundi.

Équipe :
- Enzo Ryon : direction, sommellerie, relation client haut niveau, communication éditoriale.
- Hugo Vinatier : chef (formé en cuisine étoilée), développement commercial B2B.

Trois offres :
- NOCTA Private : dîners à domicile, célébrations intimistes (tarif à partir de 55 €/pers.).
- NOCTA Corporate : cocktails, galas, comités de direction, plateaux-repas (25 à 70 €/pers. selon format).
- NOCTA Signature : expériences immersives sur-mesure (sur devis).

RÈGLES ÉDITORIALES NON NÉGOCIABLES :

1. JAMAIS "chef étoilé" → TOUJOURS "formé en cuisine étoilée".
2. Ton luxe sobre. Test : "est-ce qu'un chef étoilé ou un DG de grand groupe dirait ça naturellement ?"
3. Zéro métaphore lyrique creuse. Zéro superlatif gratuit.
4. ZÉRO INVENTION FACTUELLE : ne cite que les clients listés ci-dessus. N'invente AUCUN événement spécifique, AUCUNE anecdote, AUCUN témoignage.
5. Du concret uniquement : formats proposés, logistique, cadre, typologie de prestation, contraintes du lieu.
6. Ne promets jamais des choses qu'on ne vend pas : pas de "wedding planning", pas de "location de mobilier", pas de "décoration florale".
7. Mentionner les 3 offres de manière naturelle, sans matraquer.
8. Français impeccable. Pas d'anglicismes superflus.

## INTERDICTIONS ABSOLUES (le draft est rejeté si ces mots/tournures apparaissent)

Mots bannis (synonymes lyriques creux du luxe générique) :
  - "prestige", "prestigieux", "prestigieuse"
  - "d'exception", "exceptionnel", "exceptionnelle" (sauf usage factuel mesurable :
    "exceptionnel" pour décrire un cru précis, un millésime, un produit nommé)
  - "haut de gamme" (préférer le concret : "formés dans des maisons étoilées",
    "produits de saison", "service en gants blancs", "cuisine sourcée")
  - "raffinement", "raffiné", "raffinée"
  - "univers", "voyage", "expérience inoubliable", "moment magique"
  - "sur-mesure" et "sur mesure" comme adjectif marketing
    (préférer : "construit selon vos envies", "menu adapté à votre table",
    "format conçu autour du lieu")
  - "irréprochable", "impeccable" (creux quand on les écrit soi-même)
  - "audace", "élégance" (sauf concrète et démontrée par un détail précis)
  - "incontournable", "le meilleur", "le plus prestigieux"
  - "expérience unique", "savoir-faire d'exception", "ambiance chaleureuse",
    "moments inoubliables", "voyage culinaire", "magie", "univers culinaire",
    "notre ADN"

Formulations interdites :
  - JAMAIS "chef étoilé" → TOUJOURS "formé en cuisine étoilée".
  - JAMAIS "le meilleur" / "le plus prestigieux" / "incontournable".
  - JAMAIS d'adjectif générique sans nom propre, lieu ou produit précis derrière.
  - JAMAIS "wedding planner", "storytelling", "experience design".

Test du chef étoilé : avant chaque phrase, se demander "est-ce qu'un chef étoilé
ou un DG de grand groupe dirait ça naturellement à un dîner entre pairs ?".
Si non → réécrire avec du concret.

Préférer toujours le concret : noms de produits, de quartiers, de gestes
(découpe en salle, sommellerie au verre, dressage à l'envoi), de chiffres
(50 couverts, 18 pièces par personne, 24-36h de délai). Le luxe sobre se prouve
par les détails — pas par les adjectifs.

STRUCTURE DE LA PAGE :

Tu produis un fichier markdown avec frontmatter Astro. Format EXACT :

\`\`\`markdown
---
title: "[H1 de la page, 50-60 caractères, mot-clé cible en premier]"
description: "[Meta description, 140-160 caractères, accroche + mot-clé]"
zone: "[Nom de la zone cité exactement comme fourni]"
type: "[arrondissement|commune-92|occasion|chef-prive]"
publishDate: "[AAAA-MM-JJ]"
readingTime: "[N] min"
schemaType: "[LocalBusiness|Service]"
---

## [H2 d'accroche — positionnement NOCTA sur cette zone/occasion, 2-3 paragraphes]

[3-4 phrases concrètes : où, comment, pour quelle typologie de client.]

## [H2 — formats adaptés à la zone/occasion]

[Présentation de 2 à 3 formats NOCTA pertinents, en reprenant le nom officiel (Private/Corporate/Signature). Chaque format = 1 paragraphe court + ce qui le rend adapté à cette zone.]

## [H2 — spécificités logistiques / contraintes du lieu]

[Contraintes réelles : stationnement, accès, passage, gabarit. Si tu ne sais pas, reste générique mais précis. Pas d'invention d'adresse.]

## [H2 — pourquoi NOCTA sur cette zone/occasion]

[Arguments concrets : équipe, sommellerie, sur-mesure, clients similaires qu'on a servis (sans inventer). 1 paragraphe.]

## Demande de devis

[CTA court et sobre vers /contact. 2-3 phrases maximum.]
\`\`\`

LONGUEUR : 800 à 1200 mots de corps (hors frontmatter).

Tu ne produis QUE le markdown complet, rien d'autre. Pas de préambule, pas de conclusion hors structure, pas de commentaire sur ton travail.`;

// ============================================================
// Helpers
// ============================================================

async function loadQueue() {
  const raw = await fs.readFile(QUEUE_PATH, "utf-8");
  return { doc: YAML.parseDocument(raw), data: YAML.parse(raw) };
}

async function saveQueue(doc) {
  // Garde les commentaires YAML en écrivant via le document parsé.
  await fs.writeFile(QUEUE_PATH, String(doc), "utf-8");
}

function pickNextTopic(queue) {
  const pending = queue.topics.filter((t) => t.status === "pending");
  if (pending.length === 0) return null;
  pending.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return pending[0];
}

function updateTopicStatus(doc, slug, newStatus) {
  const topics = doc.get("topics");
  for (let i = 0; i < topics.items.length; i++) {
    const item = topics.items[i];
    if (item.get("slug") === slug) {
      item.set("status", newStatus);
      return true;
    }
  }
  return false;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// ctaType inference — logique déterministe (zéro appel LLM)
// ============================================================
// Détermine la cible du CTA contextuel (bloc "Autres zones desservies")
// des pages GEO : /prestations/private ou /prestations/corporate.
//
// Pourquoi déterministe et pas LLM :
//   - Pas d'hallucinations possibles (le LLM classifierait parfois à tort).
//   - Zéro coût token, zéro latence supplémentaire.
//   - Règles auditables et extensibles en code review.
//
// Extensibilité : si le pipeline génère une nouvelle zone business non listée
// dans BUSINESS_ZONES, il suffit de l'ajouter au tableau. Le fallback 'private'
// est intentionnel (aligne sur le template et reste safe pour les résidentiels).

const BUSINESS_ZONES = [
  "paris-1",
  "paris-2",
  "paris-8",
  "paris-9",
  "paris-15",
  "paris-17",
  "la-defense",
  "courbevoie",
  "levallois",
  "puteaux",
  "boulogne-billancourt",
  "issy-les-moulineaux",
];

const CORPORATE_TITLE_REGEX =
  /(corporate|entreprise|gala|vernissage|s[ée]minaire|afterwork|afterworks|inauguration|lancement)/i;

export function inferCtaType(entry) {
  const { type, slug = "", title = "", angle = "" } = entry;

  // 1. chef-prive → toujours private
  if (type === "chef-prive") return "private";

  // 2. zones business connues → corporate.
  // Matching par segment (avec délimiteurs) pour éviter les faux positifs
  // type 'paris-1' qui matcherait 'paris-16' ou 'paris-17'.
  const slugNormalized = slug.toLowerCase();
  const matchesBusinessZone = BUSINESS_ZONES.some((z) => {
    const escaped = z.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|-)${escaped}(?:-|$)`).test(slugNormalized);
  });
  if (matchesBusinessZone) return "corporate";

  // 3. occasion : regex sur title/angle
  if (type === "occasion") {
    const haystack = `${title} ${angle}`;
    if (CORPORATE_TITLE_REGEX.test(haystack)) return "corporate";
  }

  // 4. fallback safe
  return "private";
}

// Post-process le markdown LLM : injecte `ctaType: "..."` dans le frontmatter
// juste après la ligne `type:` (alignement avec les fichiers backfillés).
// Si `ctaType:` est déjà présent, on ne l'écrase pas.
function injectCtaType(markdown, ctaType) {
  if (/^ctaType:/m.test(markdown.split(/^---$/m)[1] ?? "")) return markdown;
  return markdown.replace(
    /^(type:\s*.+)$/m,
    (match) => `${match}\nctaType: "${ctaType}"`,
  );
}

// ============================================================
// Appel Claude
// ============================================================
async function generateDraft(client, topic) {
  const userPrompt = `Rédige la page GEO suivante en respectant STRICTEMENT la charte éditoriale NOCTA.

Sujet : ${topic.zone}
Angle : ${topic.angle}
Type : ${topic.type}
Date de publication : ${todayISO()}
Schema recommandé : ${topic.type === "commune-92" || topic.type === "arrondissement" ? "LocalBusiness" : "Service"}

Rappel crucial :
- JAMAIS "chef étoilé", TOUJOURS "formé en cuisine étoilée".
- N'invente AUCUN client, AUCUN événement, AUCUNE adresse.
- Reste sobre, concret, professionnel.
- Produis UNIQUEMENT le markdown (frontmatter + corps).`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Concatène les blocs texte de la réponse
  const markdown = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Enlève d'éventuels fences ```markdown ... ```
  return markdown
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(JSON.stringify({ status: "error", error: "ANTHROPIC_API_KEY missing" }));
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // 1. Charge la queue
  const { doc, data } = await loadQueue();
  const topic = pickNextTopic(data);
  if (!topic) {
    console.log(JSON.stringify({ status: "empty-queue" }));
    return;
  }

  console.error(`→ Génération : ${topic.slug} (priority ${topic.priority})`);

  // 2. Génère le draft
  let markdown;
  try {
    markdown = await generateDraft(client, topic);
  } catch (err) {
    console.error(JSON.stringify({ status: "error", stage: "generate", error: String(err) }));
    process.exit(1);
  }

  // 2bis. Injection déterministe du ctaType (cf. inferCtaType ci-dessus)
  const ctaType = inferCtaType(topic);
  markdown = injectCtaType(markdown, ctaType);
  console.error(`   ctaType = ${ctaType}`);

  // 3. Brand-check
  const check = await brandCheck(markdown, client, MODEL);
  console.error(`   Brand-check score : ${check.score}/10 — ${check.verdict}`);
  if (check.flags.length) {
    console.error(`   Flags : ${check.flags.join(" | ")}`);
  }

  // 4. Écrit le fichier
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${topic.slug}.md`);
  await fs.writeFile(outPath, markdown, "utf-8");
  console.error(`   → ${path.relative(ROOT, outPath)}`);

  // 5. Met à jour la queue
  const newStatus = check.verdict === "auto-publish" ? "published" : "pr-review";
  updateTopicStatus(doc, topic.slug, newStatus);
  await saveQueue(doc);

  // 6. Sortie JSON pour le workflow
  console.log(
    JSON.stringify({
      status: newStatus,
      slug: topic.slug,
      zone: topic.zone,
      score: check.score,
      flags: check.flags,
      file: path.relative(ROOT, outPath),
    })
  );
}

// ============================================================
// Test harness (zéro appel API)
// Usage : node scripts/seo-auto-generate.mjs --test-cta
// ============================================================
if (process.argv.includes("--test-cta")) {
  const cases = [
    { type: "arrondissement", slug: "traiteur-paris-8", title: "Traiteur Paris 8e", angle: "sièges sociaux, cocktails, galas" },
    { type: "arrondissement", slug: "traiteur-paris-16", title: "Traiteur Paris 16e", angle: "dîners privés, résidentiel" },
    { type: "commune-92", slug: "traiteur-courbevoie-la-defense", title: "Traiteur Courbevoie", angle: "business district, plateaux-repas" },
    { type: "chef-prive", slug: "chef-prive-paris", title: "Chef privé Paris", angle: "chef à domicile" },
    { type: "occasion", slug: "traiteur-vernissage-paris", title: "Vernissage traiteur Paris", angle: "vernissage galerie, événement culturel" },
    { type: "occasion", slug: "traiteur-mariage-intime-paris", title: "Mariage intime Paris", angle: "mariage intimiste, dîner familial" },
  ];
  console.table(cases.map((c) => ({ slug: c.slug, type: c.type, ctaType: inferCtaType(c) })));
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", error: String(err), stack: err.stack }));
  process.exit(1);
});
