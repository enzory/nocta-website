"""
geo_check.py — Contrôle « lisibilité par les assistants IA » de noctaparis.fr

Ce que fait le script, étape par étape :
  1. Vérifie que les robots des assistants IA (ChatGPT, Claude, Perplexity, Grok,
     Meta, Mistral, Google, Bing) reçoivent bien les pages (code 200).
  2. Vérifie que /llms.txt existe et cite les pages clés.
  3. Vérifie que la page « NOCTA en bref » existe et figure dans le sitemap.
  4. Vérifie que les données structurées de l'accueil pointent vers la fiche
     Google (lien permanent « cid »).
  5. Vérifie que le formulaire de contact est utilisable par un agent IA :
     chaque champ a un libellé, et aucun CAPTCHA ne bloque l'envoi.

Usage :
  pip install requests beautifulsoup4
  python3 scripts/geo_check.py                         -> production
  python3 scripts/geo_check.py http://localhost:4321   -> build local
"""
import json
import sys
import requests
from bs4 import BeautifulSoup

PROD = "https://www.noctaparis.fr"
SITE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else PROD
FACTS_PATH = "/nocta-en-bref"                      # page de faits à créer
MAPS_CID = "maps.google.com/?cid=7113184090507023875"  # fiche Google, lien permanent

ok_total, ko_total = 0, 0


def check(label, condition, detail=""):
    """Affiche une ligne OK / KO et tient le compte."""
    global ok_total, ko_total
    if condition:
        ok_total += 1
        print(f"  OK  {label}")
    else:
        ko_total += 1
        print(f"  KO  {label}  {detail}")


def get(path, ua="Mozilla/5.0"):
    """Télécharge une page en forçant l'UTF-8 (la preview locale n'envoie pas de charset)."""
    r = requests.get(SITE + path, headers={"User-Agent": ua}, timeout=20)
    r.encoding = "utf-8"
    return r


# --- 1. Accès des robots IA --------------------------------------------------
print("\n1. Accès des robots IA")
BOTS = {
    "OAI-SearchBot (ChatGPT recherche)": "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "ChatGPT-User": "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "GPTBot": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Claude-SearchBot": "Mozilla/5.0 (compatible; Claude-SearchBot/1.0)",
    "Claude-User": "Mozilla/5.0 (compatible; Claude-User/1.0)",
    "ClaudeBot": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "PerplexityBot": "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "xAI-Bot (Grok)": "Mozilla/5.0 (compatible; xAI-Bot/1.0; +https://x.ai)",
    "Meta-ExternalAgent": "Mozilla/5.0 (compatible; meta-externalagent/1.1)",
    "MistralAI-User": "Mozilla/5.0 (compatible; MistralAI-User/1.0)",
    "bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
}
for name, ua in BOTS.items():
    try:
        code = get("/traiteur/traiteur-levallois-perret", ua).status_code
    except requests.RequestException as e:
        code = f"erreur réseau ({e.__class__.__name__})"
    check(name, code == 200, f"-> {code}")

# --- 2. llms.txt -------------------------------------------------------------
print("\n2. /llms.txt")
r = get("/llms.txt")
check("/llms.txt répond 200", r.status_code == 200, f"-> {r.status_code}")
if r.status_code == 200:
    for must in ["/prestations/corporate", "/prestations/private", FACTS_PATH, "/contact"]:
        check(f"llms.txt cite {must}", must in r.text)

# --- 3. Page « NOCTA en bref » -----------------------------------------------
print("\n3. Page « NOCTA en bref »")
r = get(FACTS_PATH)
check(f"{FACTS_PATH} répond 200", r.status_code == 200, f"-> {r.status_code}")
sitemap = get("/sitemap-0.xml").text
check(f"{FACTS_PATH} est dans le sitemap", FACTS_PATH in sitemap)

# --- 4. Lien vers la fiche Google dans les données structurées ---------------
print("\n4. Données structurées de l'accueil")
soup = BeautifulSoup(get("/").text, "html.parser")
same_as = []
for tag in soup.find_all("script", type="application/ld+json"):
    try:
        data = json.loads(tag.string)
    except (TypeError, json.JSONDecodeError):
        continue
    for item in data if isinstance(data, list) else data.get("@graph", [data]):
        same_as += item.get("sameAs", []) if isinstance(item, dict) else []
check("sameAs contient le lien permanent de la fiche Google",
      any(MAPS_CID in s for s in same_as), f"-> {same_as}")
check("sameAs ne contient plus de lien share.google temporaire",
      not any("share.google" in s for s in same_as))

# --- 5. Formulaire de contact lisible par un agent ---------------------------
print("\n5. Formulaire de contact")
html = get("/contact").text
soup = BeautifulSoup(html, "html.parser")
form = soup.find("form")
check("un <form> est présent sur /contact", form is not None)
if form:
    # Le champ piège anti-spam (_gotcha) ne doit PAS avoir de libellé, mais il doit
    # être clairement marqué comme à ignorer : sinon un agent IA qui remplit le
    # formulaire risque de le remplir aussi, et Formspree classe la demande en spam.
    trap = form.find(attrs={"name": "_gotcha"})
    if trap is not None:
        check("champ piège _gotcha masqué ET ignoré (aria-hidden + tabindex=-1 + autocomplete=off)",
              "display:none" in (trap.get("style") or "").replace(" ", "")
              and trap.get("aria-hidden") == "true"
              and trap.get("tabindex") == "-1"
              and trap.get("autocomplete") == "off",
              f"-> {trap}")
    fields = [f for f in form.find_all(["input", "select", "textarea"])
              if f.get("type") not in ("hidden", "submit", "button") and f.get("name") != "_gotcha"]
    labelled_ids = {l.get("for") for l in form.find_all("label") if l.get("for")}
    for f in fields:
        name = f.get("name") or f.get("id") or "?"
        has_label = (f.get("id") in labelled_ids) or f.get("aria-label") or f.find_parent("label")
        check(f"champ « {name} » a un libellé", bool(has_label))
low = html.lower()
check("aucun CAPTCHA (reCAPTCHA, hCaptcha, Turnstile)",
      not any(k in low for k in ("recaptcha", "hcaptcha", "turnstile")))

print(f"\nRésultat : {ok_total} OK, {ko_total} KO")
