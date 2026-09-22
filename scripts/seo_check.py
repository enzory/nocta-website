"""
seo_check.py — Contrôle SEO rapide de noctaparis.fr (à relancer après chaque déploiement)

Ce que fait le script, étape par étape :
  1. Vérifie que noctaparis.fr redirige vers www en PERMANENT (308/301), pas en 307.
  2. Lit le sitemap et récupère toutes les URLs du site.
  3. Pour chaque page : longueur du title / meta description, canonical, nombre de H1.
  4. Compte combien de pages du site pointent vers chaque page (maillage interne).
  5. Affiche un tableau avec les alertes.

Usage :
  pip install requests beautifulsoup4
  python3 seo_check.py                          -> contrôle le site en production
  python3 seo_check.py http://localhost:4321    -> contrôle le build local (npm run build && npm run preview)
"""
import re
import sys
from collections import Counter
import requests
from bs4 import BeautifulSoup

PROD = "https://www.noctaparis.fr"
# Adresse à contrôler : la prod par défaut, ou celle passée en argument (preview locale)
SITE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else PROD
TITLE_MAX, DESC_MIN, DESC_MAX = 60, 110, 160   # seuils au-delà desquels Google tronque
MIN_INBOUND = 3                                 # une page doit recevoir au moins 3 liens internes

# --- 1. Redirection apex -> www (uniquement en prod) ------------------------
if SITE == PROD:
    r = requests.get("https://noctaparis.fr/", allow_redirects=False, timeout=20)
    ok = r.status_code in (301, 308)
    print(f"Apex -> www : {r.status_code} {'OK (permanent)' if ok else 'A CORRIGER (doit etre 308)'}\n")

# --- 2. URLs du sitemap -----------------------------------------------------
xml = requests.get(f"{SITE}/sitemap-0.xml", timeout=20).text
# Le sitemap contient toujours les URLs de prod : on les réécrit vers l'adresse contrôlée
urls = [u.replace(PROD, SITE) for u in re.findall(r"<loc>([^<]+)</loc>", xml)]

# --- 3. Analyse de chaque page ---------------------------------------------
inbound = Counter()   # nb de pages qui pointent vers chaque chemin
rows = []
for url in urls:
    html = requests.get(url, timeout=20).text
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string or "").strip() if soup.title else ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    desc = desc_tag["content"] if desc_tag else ""
    canon_tag = soup.find("link", rel="canonical")
    canon = canon_tag["href"] if canon_tag else ""
    h1 = len(soup.find_all("h1"))

    # Liens internes (dédoublonnés par page)
    for href in {a["href"].split("#")[0].rstrip("/") for a in soup.find_all("a", href=True)}:
        href = href.replace(PROD, "").replace(SITE, "") or "/"   # lien vers l'accueil = "/"
        if href.startswith("/"):
            inbound[href or "/"] += 1

    alerts = []
    if len(title) > TITLE_MAX: alerts.append(f"title {len(title)}c")
    if not DESC_MIN <= len(desc) <= DESC_MAX: alerts.append(f"desc {len(desc)}c")
    if canon.rstrip("/") != url.replace(SITE, PROD).rstrip("/"): alerts.append("canonical")
    if h1 != 1: alerts.append(f"{h1} H1")
    rows.append((url.replace(SITE, "") or "/", alerts))

# --- 4 & 5. Rapport ----------------------------------------------------------
print(f"{'PAGE':60} {'LIENS IN':>8}  ALERTES")
for path, alerts in rows:
    n = inbound[path.rstrip('/') or '/']
    if n < MIN_INBOUND: alerts.append("maillage faible")
    print(f"{path:60} {n:>8}  {', '.join(alerts) or 'ok'}")
