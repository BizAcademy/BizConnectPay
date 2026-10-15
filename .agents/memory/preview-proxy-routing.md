---
name: Vérifier les endpoints via le proxy d’aperçu
description: Les services du squelette peuvent intercepter des préfixes d’URL pourtant valides en accès direct.
---

Les vérifications d’un nouveau formulaire doivent inclure une requête via le domaine d’aperçu réel, et pas seulement le serveur métier en accès direct ou un routeur isolé.

**Why:** Un formulaire fonctionnait en tests HTTP isolés, mais son préfixe d’envoi était intercepté par le service API séparé du squelette et renvoyait 404 dans le navigateur.

**How to apply:** Avant de choisir un préfixe pour une nouvelle fonctionnalité métier, vérifier les chemins des artifacts existants. Ne pas supposer que toutes les URL sous un préfixe API partagé atteignent BizConnectPay. Conserver les URL compatibles avec le chemin de base et vérifier le statut réel à travers le proxy.
