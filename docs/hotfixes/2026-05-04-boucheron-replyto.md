# Hotfix Boucheron — `_replyto` hardcodé

**Date** : 2026-05-04
**Statut** : ✅ Résolu
**Commit** : `e938a3c`
**Sévérité** : Moyenne (UX dégradée, pas de perte de données)

## Symptôme

Cliente Boucheron (Myriana Canhoto) signale un Reply-To erroné dans le mail de commande :
- Reply-To affiché : `myriana@boucheron.com` ❌
- Vrai email saisi : `myriana.canhoto@boucheron.com` ✅

## Diagnostic

`src/components/BoucheronCommande.jsx` ligne 342 : `_replyto` hardcodé en string littérale au lieu d'utiliser la variable d'état `email`. Hypothèse : valeur de test/débug oubliée lors du dev initial du module (Myriana était la 1ère cliente Boucheron, son email a probablement servi de test value).

## Fix

```diff
-          _replyto: "myriana@boucheron.com",
+          _replyto: email,
```

`_cc: email` conservé (copie expéditeur — comportement attendu).

## Apprentissages

1. Toujours utiliser des placeholders évidents (`TODO_REPLYTO`, `dev@example.com`) qui faillent visiblement en prod plutôt que des valeurs réelles
2. Le `_cc` masquait partiellement le bug — sans le retour client, passé inaperçu côté NOCTA

## Lien Notion

https://www.notion.so/357825f8b38181d6ac29f39b53657ea4
