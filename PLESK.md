# BizConnectPay : GitHub → Plesk, sans build sur le serveur

La version autonome **`deploy/plesk/` est incluse dans ce dépôt**. Elle contient déjà tout le code JavaScript exécutable, les vues EJS, le CSS, le JavaScript navigateur et les logos. Il n’y a ni TypeScript à compiler, ni Vite, ni commande de build à lancer sur Plesk.

Le dépôt contient aussi l’environnement de développement. **Plesk doit utiliser `deploy/plesk/package.json`, jamais le `package.json` à la racine du dépôt.** Le manifeste autonome ne contient ni workspace pnpm ni dépendance fonctionnelle à Replit.

## Configuration initiale (une seule fois)

Exemple de dossier de déploiement Git : **`/bizconnectpay`**, relatif à la racine de votre abonnement Plesk. Créez ce dossier depuis le gestionnaire de fichiers si nécessaire.

### 1. Connecter GitHub

Dans **Sites Web & Domaines → Git**, ajouter le dépôt GitHub, sélectionner la branche à déployer, choisir le mode **Manual deployment**, et définir le dossier cible sur `/bizconnectpay`.

Après chaque push, **Pull Updates** récupère les commits et **Deploy Now** publie les fichiers dans ce dossier.

### 2. Configurer Node.js

Dans la rubrique **Node.js** du domaine :

| Réglage | Valeur pour cet exemple |
|---|---|
| Version Node.js | **21.7.3**, version utilisée sur les serveurs du propriétaire |
| Application root | `/bizconnectpay/deploy/plesk` |
| Document root | `/bizconnectpay/deploy/plesk/public` |
| Application startup file | `server.js` |
| Application mode | `production` |
| Gestionnaire de dépendances | npm |

Le chemin exact affiché peut être absolu, mais doit se terminer par ces dossiers. Ne choisissez pas la racine entière du dépôt comme document root : elle contient des fichiers serveur.

Ajouter les variables personnalisées :

```text
NODE_ENV=production
BASE_PATH=/
TRUST_PROXY=1
SITE_PREVIEW=0
DB_HOST=<serveur MySQL indiqué par votre hébergeur>
DB_PORT=3306
DB_NAME=<nom exact de votre base>
DB_USER=<utilisateur dédié à cette base>
DB_PASSWORD=<mot de passe MySQL>
SESSION_SECRET=<chaîne aléatoire d’au moins 32 caractères>
ADMIN_PASSWORD=<mot de passe administrateur de 12 à 72 octets UTF-8>
```

Configurer `PORT` selon les instructions Node.js de votre hébergeur si nécessaire ; le serveur utilise `3000` par défaut. Les paramètres de taille d’upload et de session sont décrits dans `deploy/plesk/.env.example`.

Les secrets de l’environnement de développement **ne sont pas transférés par GitHub** : les renseigner séparément dans Plesk. Le fichier `.env.example` ne contient aucun secret. Un `.env` privé, si vous en utilisez un, doit être placé dans l’application, hors `public/`, et ne doit jamais être ajouté au dépôt.

Sur Plesk, `DB_HOST=localhost` peut convenir si MySQL est sur la même machine : utiliser exactement les indications du panneau **Bases de données → Informations de connexion**. L’erreur DNS de l’ancien aperçu n’empêche pas une connexion locale correctement configurée sur Plesk.

Créer la base et son utilisateur avant le premier démarrage, avec `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` sur cette base seulement. Les tables sont créées automatiquement, sans suppression de données existantes. Activer HTTPS, nécessaire aux cookies admin sécurisés. Faire autoriser des uploads HTTP de 60 Mo et un `max_allowed_packet` MySQL d’au moins 64 Mo pour les vidéos jusqu’à 50 Mo.

### 3. Activer l’action automatique de déploiement

Dans **Git → Repository Settings → Enable additional deploy actions**, ajouter :

```sh
sh ./deploy/plesk/scripts/deploy.sh /opt/plesk/node/21/bin
```

Cette commande suppose que l’action s’exécute dans le dossier cible Git. Si votre installation utilise un autre dossier de travail, utilisez le chemin absolu du script dans le dossier déployé, par exemple :

```sh
sh /var/www/vhosts/VOTRE-DOMAINE/bizconnectpay/deploy/plesk/scripts/deploy.sh /opt/plesk/node/21/bin
```

**Adaptez une seule fois le chemin du domaine et, si nécessaire, le chemin du runtime indiqué par votre hébergeur.** Le chemin standard proposé est `/opt/plesk/node/21/bin`. Le script vérifie que le runtime exécute bien **Node.js 21.7.3** et calcule sa racine applicative à partir de son propre emplacement. Le fichier `.nvmrc` de l’application indique également `21.7.3`. Aucune version supérieure n’est nécessaire.

**Sécurité :** Node.js 21 est hors support officiel et ne reçoit plus de correctifs de sécurité. Cette livraison respecte la limite actuelle des serveurs ; prévoir une version maintenue lorsque l’hébergeur la proposera.

L’action exécute uniquement :

1. `npm ci --omit=dev` avec le verrouillage versionné, pour installer les dépendances du serveur ;
2. une vérification de syntaxe sans génération de fichiers.

Elle ne lance **aucun build**, aucun autre serveur, et ne lit ni ne modifie les secrets ou les données MySQL. Les dépendances ne sont pas mises dans Git : leurs fichiers natifs doivent correspondre au système du serveur.

**Important :** le runtime Node.js/npm doit être accessible depuis les actions Git. Plesk peut exécuter ces actions dans une prison chroot si l’accès shell est désactivé. Si le script indique que le runtime est introuvable, l’hébergeur doit rendre Node.js/npm accessibles aux actions Git ou adapter l’accès shell. Sans cela, l’installation automatique des dépendances ne peut pas fonctionner ; ce n’est pas une compilation manquante. Le serveur doit aussi pouvoir télécharger les paquets depuis le registre npm.

## Ensuite, à chaque mise à jour

1. **Push sur GitHub** du dépôt, y compris `deploy/plesk/`.
2. Dans Plesk : **Pull Updates → Deploy Now**. Attendre que l’action réussisse.
3. Dans Node.js : **Restart**.

**Aucun bouton “Build”, aucune commande `npm run build`, aucun pnpm nécessaire sur Plesk.**

Vérification après démarrage :

- `https://votre-domaine/healthz` doit afficher `status: "ok"`, `databaseAvailable: true`, `adminAvailable: true`.
- `https://votre-domaine/admin` ouvre la connexion administrateur.

La production refuse explicitement de démarrer si MySQL ou les secrets obligatoires ne sont pas valides. L’action de déploiement ne peut pas créer les identifiants de votre hébergeur ni garantir une connexion à un serveur mal configuré.

## Maintenir les sources et la livraison synchronisées

La source reste `artifacts/bizconnectpay/`. Après une modification de cette source, préparer les fichiers **avant** le push (dans l’environnement de développement, jamais sur Plesk) :

```sh
pnpm --filter @workspace/bizconnectpay run prepare:plesk
# Seulement si les dépendances ont changé :
npm --prefix deploy/plesk install --package-lock-only --ignore-scripts --omit=dev
pnpm --filter @workspace/bizconnectpay run check:plesk
```

Le dossier prêt à démarrer est déjà préparé pour cette livraison. Inclure ses modifications dans le même commit que les sources. `check:plesk` détecte les fichiers livrés désynchronisés et les différences de dépendances du verrouillage. Le script de préparation conserve le verrouillage npm, les éventuels secrets locaux et les dépendances déjà installées.

Guide détaillé : `deploy/plesk/README.md`.

Documentation officielle :
- [Plesk : dépôt Git distant, Pull/Deploy et actions de déploiement](https://docs.plesk.com/en-US/obsidian/customer-guide/git-support/using-remote-git-hosting.75848/#enable-additional-deployment-actions)
- [Plesk : héberger une application Node.js](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/)
