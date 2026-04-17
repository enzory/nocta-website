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

// ============================================================
// COUCHE 1 — règles déterministes
// ============================================================

// Mots/expressions strictement interdits (violation éditoriale).
const FORBIDDEN_PATTERNS = [
  { pattern: /\bchef[s]?\s+étoilé[s]?\b/gi, flag: "CHEF_ETOILE", eliminatory: true },
  { pattern: /\bexpérience\s+unique\b/gi, flag: "EXPERIENCE_UNIQUE", eliminatory: false },
  { pattern: /\bmoments?\s+inoubliables?\b/gi, flag: "MOMENTS_INOUBLIABLES", eliminatory: true },
  { pattern: /\bambiance\s+chaleureuse\b/gi, flag: "AMBIANCE_CHALEUREUSE", eliminatory: true },
  { pattern: /\bvoyage\s+culinaire\b/gi, flag: "VOYAGE_CULINAIRE", eliminatory: true },
  { pattern: /\bsavoir[-\s]faire\s+d'exception\b/gi, flag: "SAVOIR_FAIRE_EXCEPTION", eliminatory: true },
  { pattern: /\bnotre\s+ADN\b/gi, flag: "NOTRE_ADN", eliminatory: true },
  { pattern: /\bunivers\s+culinaire\b/gi, flag: "UNIVERS_CULINAIRE", eliminatory: true },
  { pattern: /\bmagie\s+de\b/gi, flag: "MAGIE_DE", eliminatory: false },
  { pattern: /\bsublimer?\b/gi, flag: "SUBLIMER", eliminatory: false },
  { pattern: /\benchanter?\b/gi, flag: "ENCHANTER", eliminatory: false },
  // Anglicismes marketing creux
  { pattern: /\bwedding\s+planner\b/gi, flag: "WEDDING_PLANNER", eliminatory: true },
  { pattern: /\bstorytelling\b/gi, flag: "STORYTELLING", eliminatory: false },
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
  const required = ["title", "description", "zone", "type", "slug", "publishDate"];
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
export async function brandCheck(markdown, claudeClient, model = "claude-sonnet-4-6") {
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

  const hasEliminatory = allFlags.some((f) => f.eliminatory);

  // Couche 2 — scoring qualitatif
  const qualitative = await scoreWithClaude(markdown, claudeClient, model);
  const qualScore = Number(qualitative.score) || 0;

  // Verdict final
  // - Flag éliminatoire OU score qualitatif < 8 → PR review.
  // - Sinon → auto-publish.
  // TEMP Phase 1 (semaines 1-6) : tout passe en PR pour relecture.
  // Retirer une fois que 95%+ des PRs partent sans édition.
  const verdict = "pr-review";

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
      hasEliminatory,
    },
  };
}

// ============================================================
// CLI mode (test standalone) : node seo-brand-check.mjs path/to/draft.md
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs/promises");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node seo-brand-check.mjs <path-to-draft.md>");
    process.exit(1);
  }
  const md = await fs.readFile(filePath, "utf-8");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const result = await brandCheck(md, client);
  console.log(JSON.stringify(result, null, 2));
}
