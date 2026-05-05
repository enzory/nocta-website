// Vercel Serverless Function — retourne HTTP 410 Gone pour les pages
// définitivement supprimées (signal fort à Google : désindexer).
//
// Ciblé via vercel.json `rewrites` sur les chemins legacy orphelins.
// Préférable à un 404 (qui dit "page non trouvée, peut revenir") ou
// à un 301 vers une page non pertinente.

export default function handler(req, res) {
  res.status(410);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Page disparue — NOCTA</title>
    <style>
      body { font-family: 'Cormorant Garamond', Georgia, serif; background: #EEEBE3; color: #0A0A0A; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; text-align: center; }
      h1 { font-style: italic; font-weight: 300; font-size: clamp(1.75rem, 4vw, 2.5rem); margin: 0 0 1rem; }
      p { font-family: system-ui, sans-serif; font-weight: 300; color: #4a4a4a; margin: 0 0 2rem; }
      a { display: inline-block; font-family: system-ui, sans-serif; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em; padding: 0.85rem 2rem; background: #0A0A0A; color: #EEEBE3; text-decoration: none; }
      a:hover { background: #2a2a2a; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cette page n'existe plus.</h1>
      <p>Le contenu a été retiré ou n'a jamais existé.</p>
      <a href="/">Retour à l'accueil</a>
    </main>
  </body>
</html>`);
}
