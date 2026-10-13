---
name: Verrouillages npm externes
description: Registre privé de développement dans les livraisons destinées à un hébergement externe.
---

Vérifier toutes les adresses `resolved` des verrouillages exportés, pas seulement la configuration du registre npm. Une installation réussie dans l’environnement de développement ne suffit pas à valider la portabilité.

**Why:** Le verrouillage généré pour Plesk contenait des adresses `package-firewall.replit.internal`. Les tests locaux pouvaient les atteindre, mais l’installation réelle dans Plesk échouait avec `ENOTFOUND`.

**How to apply:** Conserver le registre sécurisé de l’environnement de développement. Dans la livraison externe seulement, utiliser des URL npm publiques, sans changer les versions ni les empreintes d’intégrité ; rejeter les hôtes privés inconnus lors de la validation de l’export. Préférer une vérification d’installation dans un environnement externe indépendant quand elle est disponible.
