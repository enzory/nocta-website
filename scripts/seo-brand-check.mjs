#!/usr/bin/env node
/**
 * ============================================================
 * seo-brand-check.mjs
 * ============================================================
 * Validateur éditorial NOCTA. Deux couches :
 *
 *   COUCHE 1 — règles déterministes (mots interdits, structure).
 *               Un seul flag éliminatoire = verdict "pr-review".
 *
 *   COUCHE 2 — scoring LLM (appel Claude sur 4 axes qualitatifs).
 *               Pondération : ton sobre 3pts, pas d'invention 3pts,
 *               concret 2pts, structure 2pts → /10.
 *
 * Verdict :
 *   - auto-publish  : score >= 8 ET 0 flag éliminatoire
 *   - pr-review     : score < 8 OU flag éliminatoire → PR créée
 *
 * Export :
 *   brandCheck(markdown, claudeClient, model)
 *     → { score, verdict, flags, details }
 * ============================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEO_DIR = path.resolve(__dirname, "../src/content/geo");

// ============================================================
// COUCHE 1 — règles déterministes
// ============================================================

// Mots/expressions strictement interdits (violation éditoriale).
//
// `eliminatory: true` → le draft passe automatiquement en "pr-review" pour relecture.
// `eliminatory: false` → simple flag, pondéré dans le scoring qualitatif.
//
// La liste est durcie post-audit 2026-04-27 : "prestige", "d'exception", "haut de gamme"
// utilisés en adjectifs marketing sont désormais éliminatoires (8 occurrences trouvées
// dans les pages auto-générées de Sprint 4-5).
const FORBIDDEN_PATTERNS = [
  // Formulations historiquement bannies
  { pattern: /\bchef[s]?\s+étoilé[s]?\b/gi, flag: "CHEF_ETOILE", eliminatory: true },
  { pattern: /\bexpérience\s+unique\b/gi, flag: "EXPERIENCE_UNIQUE", eliminatory: true },
  { pattern: /\bmoments?\s+inoubliables?\b/gi, flag: "MOMENTS_INOUBLIABLES", eliminatory: true },
  { pattern: /\bambiance\s+chaleureuse\b/gi, flag: "AMBIANCE_CHALEUREUSE", eliminatory: true },
  { pattern: /\bvoyage\s+culinaire\b/gi, flag: "VOYAGE_CULINAIRE", eliminatory: true },
  { pattern: /\bsavoir[-\s]faire\s+d'exception\b/gi, flag: "SAVOIR_FAIRE_EXCEPTION", eliminatory: true },
  { pattern: /\bnotre\s+ADN\b/gi, flag: "NOTRE_ADN", eliminatory: true },
  { pattern: /\bunivers\s+culinaire\b/gi, flag: "UNIVERS_CULINAIRE", eliminatory: true },
  { pattern: /\bmagie\s+de\b/gi, flag: "MAGIE_DE", eliminatory: true },
  { pattern: /\bmoment\s+magique\b/gi, flag: "MOMENT_MAGIQUE", eliminatory: true },

  // Bannis post-audit 2026-04-27 (luxe générique creux)
  { pattern: /\bprestig(?:e|ieux|ieuse|ieuses|ieux)\b/gi, flag: "PRESTIGE", eliminatory: true },
  { pattern: /\bd'exception\b/gi, flag: "D_EXCEPTION", eliminatory: true },
  { pattern: /\b(?:haut|hauts|haute|hautes)\s+de\s+gamme\b/gi, flag: "HAUT_DE_GAMME", eliminatory: true },
  { pattern: /\braffin(?:é|ée|és|ées|ement)\b/gi, flag: "RAFFINEMENT", eliminatory: true },
  { pattern: /\b(?:irréprochable|impeccable)s?\b/gi, flag: "IRREPROCHABLE", eliminatory: true },
  { pattern: /\bincontournables?\b/gi, flag: "INCONTOURNABLE", eliminatory: true },
  { pattern: /\ble\s+meilleur\b/gi, flag: "LE_MEILLEUR", eliminatory: true },
  { pattern: /\b(?:sur-mesure|sur\s+mesure)\b/gi, flag: "SUR_MESURE_ADJ", eliminatory: false },

  // Soft flags : pondération dans le scoring, pas d'éliminatoire automatique
  { pattern: /\bsublimer?\b/gi, flag: "SUBLIMER", eliminatory: false },
  { pattern: /\benchanter?\b/gi, flag: "ENCHANTER", eliminatory: false },
  { pattern: /\b(?:audace|élégance)\b/gi, flag: "AUDACE_ELEGANCE", eliminatory: false },

  // Anglicismes marketing creux
  { pattern: /\bwedding\s+planner\b/gi, flag: "WEDDING_PLANNER", eliminatory: true },
  { pattern: /\bstorytelling\b/gi, flag: "STORYTELLING", eliminatory: true },
  { pattern: /\bexperience\s+design\b/gi, flag: "EXPERIENCE_DESIGN", eliminatory: true },
];

// Vérifie que le frontmatter est bien formé et complet
function checkFrontmatter(markdown) {
  const flags = [];
  const m = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) {
    flags.push({ code: "FRONTMATTER_MISSING", eliminatory: true });
    return { flags, fields: {} };
  }
  const front = m[1];
  const required = ["title", "description", "zone", "type", "publishDate"];
  const fields = {};
  for (const key of required) {
    const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m");
    const match = front.match(re);
    if (!match) flags.push({ code: `FRONTMATTER_MISSING_${key.toUpperCase()}`, eliminatory: true });
    else fields[key] = match[1].trim().replace(/^["']|["']$/g, "");
  }
  // Longueurs recommandées SEO
  if (fields.title && fields.title.length > 65)
    flags.push({ code: "TITLE_TOO_LONG", eliminatory: false, detail: `${fields.title.length} chars` });
  if (fields.description && (fields.description.length < 120 || fields.description.length > 165))
    flags.push({
      code: "META_DESC_LENGTH",
      eliminatory: false,
      detail: `${fields.description.length} chars`,
    });
  return { flags, fields };
}

// Longueur du corps (hors frontmatter)
function checkBodyLength(markdown) {
  const body = markdown.replace(/^---[\s\S]*?---\s*\n/, "");
  const words = body.split(/\s+/).filter(Boolean).length;
  const flags = [];
  if (words < 700) flags.push({ code: "BODY_TOO_SHORT", eliminatory: true, detail: `${words} mots` });
  else if (words > 1500)
    flags.push({ code: "BODY_TOO_LONG", eliminatory: false, detail: `${words} mots` });
  return { flags, words };
}

// Détecte les mots interdits
function checkForbiddenPatterns(markdown) {
  const flags = [];
  for (const { pattern, flag, eliminatory } of FORBIDDEN_PATTERNS) {
    const matches = markdown.match(pattern);
    if (matches) {
      flags.push({
        code: flag,
        eliminatory,
        detail: `${matches.length} occurrence(s)`,
      });
    }
  }
  return flags;
}

// Détecte les clients inventés (seuls clients autorisés : ceux listés)
const AUTHORIZED_CLIENTS = [
  "Boucheron",
  "Biologique Recherche",
  "The Galion Project",
  "Galion Project",
  "Galion",
  "Colombus Consulting",
  "Colombus",
  "Jus Mundi",
];

function checkClientInvention(markdown) {
  const flags = [];
  // Heuristique : cherche des patterns "pour [Nom Propre]" ou "chez [Nom Propre]"
  // suivi d'un nom d'entreprise non autorisé.
  const suspectPatterns = [
    /(?:pour|chez|avec)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/g,
  ];
  for (const pat of suspectPatterns) {
    let match;
    while ((match = pat.exec(markdown)) !== null) {
      const candidate = match[1].trim();
      // Ignore mots français courants qui commencent par majuscule (début phrase)
      if (/^(Paris|France|Courbevoie|Neuilly|Boulogne|Levallois|Puteaux|La Défense|Île-de-France)/.test(candidate))
        continue;
      // Ignore si c'est un client autorisé
      if (AUTHORIZED_CLIENTS.some((c) => candidate.includes(c))) continue;
      // Ignore les noms d'offres NOCTA
      if (/NOCTA|Private|Corporate|Signature/.test(candidate)) continue;
      // Ignore si ça commence par mot générique
      if (/^(Le|La|Les|Un|Une|Des|Notre|Vos|Votre|Son|Sa|Ses)\s/.test(candidate)) continue;
      flags.push({
        code: "SUSPECT_CLIENT_MENTION",
        eliminatory: false,
        detail: candidate,
      });
    }
  }
  return flags;
}

// ============================================================
// COUCHE 1bis — duplication inter-pages (anti-cannibalisation)
// ============================================================
// Calcule le taux de 5-grammes du candidat déjà présents dans le corpus GEO
// existant. Seuil mesuré à la recon : duplication max observée ~25 % par page.
// On flag éliminatoire à 35 % (marge de 10 pt) pour bloquer un draft trop
// templatisé sans pénaliser une page légitimement distincte.

const DUP_THRESHOLD = 35;

const bodyOf = (md) => md.replace(/^---[\s\S]*?\n---\s*\n/, "");
const tokensOf = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9€]+/g) || [];

function shingleSet(tokens, n = 5) {
  const set = new Set();
  for (let i = 0; i + n <= tokens.length; i++) set.add(tokens.slice(i, i + n).join(" "));
  return set;
}

// Union des 5-grammes de tous les .md GEO existants, hors candidat (excludeId).
// Tolérant : si le dossier est absent/illisible, renvoie un set vide (dup = 0).
function loadCorpusShingles(excludeId) {
  const set = new Set();
  let files;
  try {
    files = fs.readdirSync(GEO_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return set;
  }
  for (const f of files) {
    if (excludeId && f === excludeId) continue;
    try {
      const md = fs.readFileSync(path.join(GEO_DIR, f), "utf-8");
      shingleSet(tokensOf(bodyOf(md))).forEach((s) => set.add(s));
    } catch {
      /* fichier illisible — ignoré */
    }
  }
  return set;
}

function checkDuplication(markdown, excludeId) {
  const candidate = shingleSet(tokensOf(bodyOf(markdown)));
  if (candidate.size === 0) return { flags: [], dupPct: 0 };
  const corpus = loadCorpusShingles(excludeId);
  let dup = 0;
  for (const s of candidate) if (corpus.has(s)) dup++;
  const dupPct = Math.round((100 * dup) / candidate.size);
  const flags = [];
  if (dupPct >= DUP_THRESHOLD)
    flags.push({ code: "DUP_TOO_HIGH", eliminatory: true, detail: `${dupPct}%` });
  return { flags, dupPct };
}

// ============================================================
// COUCHE 2 — scoring qualitatif via Claude
// ============================================================

const SCORING_PROMPT = `Tu es l'éditeur en chef de NOCTA Catering. Ton job : valider ou rejeter un contenu SEO avant publication.

NOCTA est un traiteur HAUT DE GAMME parisien. Clients : Boucheron, Biologique Recherche, The Galion Project, Colombus Consulting, Jus Mundi.

Règles éditoriales NOCTA :
- Jamais "chef étoilé" → "formé en cuisine étoilée"
- Ton luxe sobre : "est-ce qu'un chef étoilé ou un DG de grand groupe dirait ça naturellement ?"
- Zéro métaphore creuse, zéro superlatif gratuit
- Zéro invention factuelle (clients, événements, anecdotes)
- Du concret uniquement

Note le contenu sur 4 axes (total /10) :

1. TON SOBRE (0-3 pts) : langue professionnelle, sans emphase, sans marketing creux.
2. PAS D'INVENTION (0-3 pts) : aucun client/événement/chiffre inventé. Si le texte cite un client ou une anecdote spécifique qui n'est PAS dans la liste autorisée → 0.
3. CONCRET (0-2 pts) : formats, logistique, typologie client précise. Pas de généralités creuses.
4. STRUCTURE (0-2 pts) : H2 bien hiérarchisés, paragraphes équilibrés, CTA clair.

Tu réponds UNIQUEMENT avec un objet JSON strict :

{"score": 8.5, "ton": 3, "invention": 3, "concret": 2, "structure": 1.5, "comment": "Une phrase courte."}

Pas de texte autour. Uniquement le JSON.`;

async function scoreWithClaude(markdown, client, model) {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      system: SCORING_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voici le contenu à scorer :\n\n${markdown}`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    // Extrait le JSON (gère le cas où Claude ajouterait un fence)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in scoring response");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`   ⚠ Scoring Claude failed: ${err.message}`);
    // Si le scoring échoue, on est prudent : on force la PR review.
    return { score: 0, ton: 0, invention: 0, concret: 0, structure: 0, comment: `Scoring failed: ${err.message}` };
  }
}

// ============================================================
// EXPORT : brandCheck
// ============================================================
export async function brandCheck(markdown, claudeClient, model = "claude-sonnet-4-6", excludeId = null) {
  const allFlags = [];

  // Couche 1
  const { flags: frontFlags } = checkFrontmatter(markdown);
  allFlags.push(...frontFlags);

  const { flags: bodyFlags, words } = checkBodyLength(markdown);
  allFlags.push(...bodyFlags);

  const forbidFlags = checkForbiddenPatterns(markdown);
  allFlags.push(...forbidFlags);

  const clientFlags = checkClientInvention(markdown);
  allFlags.push(...clientFlags);

  // Couche 1bis — duplication vs corpus GEO existant
  const { flags: dupFlags, dupPct } = checkDuplication(markdown, excludeId);
  allFlags.push(...dupFlags);

  const hasEliminatory = allFlags.some((f) => f.eliminatory);

  // Couche 2 — scoring qualitatif
  const qualitative = await scoreWithClaude(markdown, claudeClient, model);
  const qualScore = Number(qualitative.score) || 0;

  // Verdict final
  // - Flag éliminatoire OU score qualitatif < 8 → PR review.
  // - Sinon → auto-publish.
  const verdict = hasEliminatory || qualScore < 8 ? "pr-review" : "auto-publish";

  return {
    score: qualScore,
    verdict,
    flags: allFlags.map((f) => `${f.code}${f.detail ? `(${f.detail})` : ""}`),
    details: {
      frontmatter: frontFlags,
      body: bodyFlags,
      forbidden: forbidFlags,
      client: clientFlags,
      qualitative,
      words,
      dupPct,
      hasEliminatory,
    },
  };
}

// ============================================================
// CLI mode (test standalone) : node seo-brand-check.mjs path/to/draft.md
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const fsp = await import("node:fs/promises");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node seo-brand-check.mjs <path-to-draft.md>");
    process.exit(1);
  }
  const md = await fsp.readFile(filePath, "utf-8");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // excludeId = nom du fichier candidat → évite l'auto-comparaison s'il est
  // déjà présent dans src/content/geo/ (cas du test CLI sur un fichier publié).
  const result = await brandCheck(md, client, "claude-sonnet-4-6", path.basename(filePath));
  console.log(JSON.stringify(result, null, 2));
}
