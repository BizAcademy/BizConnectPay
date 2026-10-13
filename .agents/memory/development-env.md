---
name: Variables de développement
description: Injection des variables propres au mode aperçu dans les workflows gérés.
---

Ne pas supposer qu’une variable déclarée sous `services.development.env` est injectée dans le processus du workflow.

**Why:** Une déclaration validée dans les métadonnées de l’artifact n’a pas été appliquée au serveur ; la même variable configurée avec la portée `development` a bien été injectée.

**How to apply:** Pour les valeurs uniquement destinées à l’aperçu, utiliser la gestion des variables avec `environment: "development"` et vérifier le comportement du processus. Ne jamais activer un mode aperçu en production pour masquer une configuration manquante.
