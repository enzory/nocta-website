"""
indexnow_ping.py — Prévient Bing (et donc ChatGPT) que les pages du site ont changé.

Étapes :
  1. Vérifie que le fichier de clé est bien en ligne (preuve que le site est à nous).
  2. Lit la liste des pages dans le sitemap de production.
  3. Envoie cette liste à IndexNow, qui la transmet à Bing et aux autres moteurs.

Usage : python3 scripts/indexnow_ping.py
Lancé automatiquement par .github/workflows/indexnow.yml après chaque déploiement de production.
"""
import re
import sys

import requests

SITE = "https://www.noctaparis.fr"
HOST = "www.noctaparis.fr"
KEY = "7eb23246ed655167548cb598df0aea68"  # doit être identique au contenu de public/<KEY>.txt
KEY_URL = f"{SITE}/{KEY}.txt"

# 1. Le fichier de clé doit répondre et contenir la clé, sinon IndexNow refusera.
r = requests.get(KEY_URL, timeout=20)
if r.status_code != 200 or r.text.strip() != KEY:
    print(f"KO : fichier de clé introuvable ou incorrect ({KEY_URL} -> {r.status_code})")
    sys.exit(1)

# 2. Toutes les pages listées dans le sitemap.
xml = requests.get(f"{SITE}/sitemap-0.xml", timeout=20).text
urls = re.findall(r"<loc>([^<]+)</loc>", xml)
if not urls:
    print("KO : aucune URL trouvée dans le sitemap")
    sys.exit(1)

# 3. Envoi groupé. 200 = reçu, 202 = reçu, clé en cours de vérification.
payload = {"host": HOST, "key": KEY, "keyLocation": KEY_URL, "urlList": urls}
resp = requests.post("https://api.indexnow.org/indexnow", json=payload, timeout=30)
print(f"{len(urls)} URL envoyées -> réponse {resp.status_code}")
sys.exit(0 if resp.status_code in (200, 202) else 1)
