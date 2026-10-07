"""
facts_check.py — Garde-fou « le site ne se contredit pas » pour noctaparis.fr

Pourquoi : un assistant IA qui lit deux prix ou deux délais différents pour la
même offre a moins de raisons de recommander NOCTA. Ce script cherche, dans les
pages construites, les formulations qui contredisent les faits de référence.

Faits de référence (validés par Enzo le 06/10/2026, complétés le 07/10/2026) :
  - NOCTA Private : entre 70 et 250 € par personne, chef et service compris
  - NOCTA Private, convives : à table, de quelques convives à une cinquantaine,
    selon le lieu et le mobilier disponible (location de matériel chiffrée dans le devis)
  - Cocktail : à partir de 54 € HT par personne
  - Plateaux-repas : non proposés actuellement
  - Minimum de commande : 500 € HT, hors livraison (jamais TTC)
  - Réservation : possible dès 24 heures à l'avance, selon disponibilité
    (une semaine conseillée pour les dîners servis et les événements de plus de 50 personnes)
  - Réponse aux demandes de devis : sous 48 heures (urgences : par téléphone)
  - Règle éditoriale : jamais « chef étoilé » (toujours « formé en cuisine étoilée »)

Usage :
  npm run build                       # construit le site dans dist/
  python3 scripts/facts_check.py      # analyse dist/ ; code de sortie 1 si un problème est trouvé
  python3 scripts/facts_check.py https://www.noctaparis.fr   # analyse la prod via le sitemap
"""
import pathlib
import re
import sys

import requests
from bs4 import BeautifulSoup

# Chaque règle : (expression à NE PAS trouver, explication affichée)
FORBIDDEN = [
    # « à partir de / dès / démarre à 55 € » = ancien prix d'entrée Private.
    # (« 55 € HT » pour un buffet reste légitime.)
    (r"(?:à partir de|dès|démarre à)\s+55\s?(?:€|euros)", "prix Private obsolète (référence : 70 à 250 € par personne)"),
    # Délais de réservation qui imposent PLUS que 24 heures comme minimum
    # (une recommandation formulée comme un conseil reste autorisée).
    (r"(?:3|trois)\s+jours\s+minimum|minimum\s+(?:de\s+)?(?:3|trois)\s+jours|72\s?(?:h\b|heures)\s+minimum"
     r"|minimum\s+de\s+72\s?(?:h\b|heures)|au\s+moins\s+72\s?(?:h\b|heures)|48\s?à\s?72\s?(?:h\b|heures)"
     r"|délai de réservation minimum|au\s+minimum\s+(?:\d+|deux|trois)\s+(?:à\s+\d+\s+)?(?:jours|semaines)"
     r"|jours\s+ouvrés\s+(?:est|sont)\s+nécessaires?",
     "ancien délai minimum de réservation (référence : dès 24 heures, selon disponibilité)"),
    # Anciennes fourchettes : 24 à 36 h, 36 h, 24 à 48 h.
    (r"\b24\s?(?:h|heures)?\s?à\s?(?:36|48)\s?(?:h\b|heures)|\b36\s?(?:h\b|heures\b)",
     "ancienne fourchette de délai (référence : réservation dès 24 h, devis sous 48 h)"),
    # Un devis promis en 24 h contredit la règle des 48 heures.
    (r"devis[^.]{0,60}\b24\s?(?:h\b|heures)|\b24\s?(?:h\b|heures)[^.]{0,40}(?:devis|première proposition)",
     "délai de devis en 24 h (référence : sous 48 heures)"),
    (r"500\s?€\s?TTC", "minimum de commande en TTC (référence : 500 € HT, hors livraison)"),
    (r"chef\s+étoilé", "règle éditoriale : écrire « formé en cuisine étoilée »"),
    # Plateaux-repas : offre non proposée actuellement (logistique).
    (r"plateaux?[\s-]repas", "offre non proposée actuellement (plateaux-repas) : retirer la mention"),
    # Ancienne fourchette cocktail.
    (r"\b50\s?(?:€\s?)?(?:-|–|à)\s?55\s?€", "fourchette cocktail obsolète (référence : à partir de 54 € HT par personne)"),
    # Anciennes limites de convives Private.
    (r"\b(?:4|6)\s?(?:-|–|à)\s?(?:8|20)\s+(?:convives|personnes|invités)"
     r"|jusqu[’']à\s+(?:8|20)\s+(?:convives|personnes|invités)",
     "ancienne limite de convives (référence : jusqu'à une cinquantaine selon le lieu et le mobilier)"),
]


def page_texts():
    """Renvoie une liste (nom de page, texte visible + JSON-LD) à analyser."""
    if len(sys.argv) > 1:  # mode prod : on lit les pages listées dans le sitemap
        site = sys.argv[1].rstrip("/")
        xml = requests.get(f"{site}/sitemap-0.xml", timeout=20).text
        for url in re.findall(r"<loc>([^<]+)</loc>", xml):
            r = requests.get(url, timeout=20)
            r.encoding = "utf-8"
            yield url.replace(site, "") or "/", extract(r.text)
    else:  # mode build : on lit les fichiers HTML de dist/
        for path in sorted(pathlib.Path("dist").rglob("*.html")):
            yield str(path), extract(path.read_text(encoding="utf-8"))


def extract(html):
    """Texte lisible de la page + contenu des JSON-LD (lus par Google et les IA)."""
    soup = BeautifulSoup(html, "html.parser")
    jsonld = " ".join(s.get_text() for s in soup.find_all("script", type="application/ld+json"))
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(" ", strip=True) + " " + jsonld


problems = 0
for name, text in page_texts():
    for pattern, why in FORBIDDEN:
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            context = text[max(0, m.start() - 60): m.end() + 60].replace("\n", " ")
            print(f"{name}\n  -> {why}\n     « …{context}… »\n")
            problems += 1

print(f"Résultat : {problems} contradiction(s) trouvée(s)")
sys.exit(1 if problems else 0)
