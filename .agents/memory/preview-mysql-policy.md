---
name: Aperçu et MySQL distant
description: Pourquoi l’aperçu public peut démarrer sans connexion MySQL, contrairement à la production.
---

La configuration d’une base externe ne doit pas empêcher de consulter la référence publique en mode aperçu explicitement activé. Les fonctions MySQL indisponibles doivent afficher une erreur explicite, jamais annoncer une opération réussie.

**Why:** L’utilisateur a demandé de réparer le démarrage de l’artifact pendant la configuration du serveur MySQL distant. Conserver un aperçu public permet cette vérification sans contourner l’authentification ou prétendre que les fonctions de base de données ont été validées.

**How to apply:** Conserver cette tolérance uniquement en développement avec aperçu explicitement activé, pour les erreurs de connexion connues. Les erreurs de code ou de schéma et les échecs MySQL en production restent bloquants. Ne pas remplacer la base externe par un stockage factice pour débloquer l’aperçu.
