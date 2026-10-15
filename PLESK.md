# BizConnectPay : GitHub → Plesk, sans build sur le serveur

**Mise à jour optimisation des images :** cette version ajoute `sharp` (compatible Node.js 21.7.3). Après **Pull Updates → Deploy Now**, cliquer une fois sur **NPM Install**, puis **Restart App**. Aucun build applicatif n’est nécessaire. Les images MySQL déjà enregistrées sont optimisées automatiquement à la demande ; leurs originaux sont conservés.

**Formulaire Contact :** les demandes sont enregistrées dans MySQL et consultables sous **Admin → Messages de contact**. La table nécessaire est créée automatiquement au démarrage, sans suppression des données existantes. Aucun SMTP ni envoi d’e-mail automatique n’est configuré ; « Répondre par e-mail » ouvre votre messagerie. Le formulaire signale clairement un échec MySQL et ne confirme jamais un envoi non enregistré.

**Navigation et langues :** le site public dispose d’un menu ordinateur et d’un menu mobile, ainsi que du choix français/anglais mémorisé pendant un an. Configurez les URL **Se connecter** et **Commencer** dans **Admin → Paramètres** (sans URL, les contrôles d’en-tête sont désactivés). La connexion client est distincte du panneau `/admin/login`. Les textes fixes de toutes les pages publiques sont traduits ; la grille de tarifs personnalisée dispose d’un éditeur anglais dans **Admin → Tarifs**. Les descriptions anglaises des images se renseignent dans **Paramètres**. Le panneau d’administration reste en français. Cette mise à jour n’ajoute aucune dépendance et ne nécessite aucun build sur Plesk.

**Pays du formulaire Contact :** dans **Admin → Pays du formulaire**, cochez les pays à proposer puis enregistrez. Tous les pays et territoires du catalogue sont visibles par défaut ; une sélection vide désactive explicitement l’envoi plutôt que de réactiver tous les pays. La sélection est conservée dans MySQL et appliquée également côté serveur. Les drapeaux sont locaux et légers. Les territoires sans indicatif attribué sont signalés et non sélectionnables dans le formulaire public. Aucun changement de schéma ni nouvelle dépendance n’est requis.

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
| Application startup file | `app.js` |
| Application mode | `production` |
| Gestionnaire de dépendances | npm |

Le chemin exact affiché peut être absolu, mais doit se terminer par ces dossiers. Ne choisissez pas la racine entière du dépôt comme document root : elle contient des fichiers serveur.

`app.js` est le point d’entrée conventionnel utilisé pour la détection Node.js de Passenger. Il charge simplement `server.js`, sans changer le fonctionnement de l’application. Le script npm `start` reste `node server.js`.

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

### 3. Installer les dépendances avec le bouton Plesk

Après le premier **Pull Updates → Deploy Now**, dans la rubrique **Node.js**, cliquer sur **NPM Install / Installer NPM**, puis sur **Restart**. Cette installation initiale est nécessaire : les modules du serveur ne sont pas stockés dans Git. Elle ne compile pas l’application.

La livraison utilise `https://registry.npmjs.org/` dans `.npmrc` et dans les adresses `resolved` du verrouillage npm, sans dépendance à un registre interne de l’environnement de développement. Si une ancienne livraison a échoué avec `ENOTFOUND package-firewall.replit.internal`, publier cette correction puis recliquer sur **NPM Install** ; ne pas supprimer la base ou les secrets.

**Ne pas activer “Enable additional deploy actions”.** Si la commande proposée auparavant y a déjà été ajoutée, la supprimer et désactiver cette option. Aucun script de déploiement, accès SSH ou commande à copier n’est nécessaire.

Choisir **Node.js 21.7.3** dans Plesk. Le fichier `.nvmrc` de l’application indique également `21.7.3` ; aucune version supérieure n’est requise.

Les déploiements suivants doivent conserver le dossier `deploy/plesk/node_modules/` installé sur le serveur. Ne pas vider le dossier applicatif avant de publier les fichiers depuis Git.

**Sécurité :** Node.js 21 est hors support officiel et ne reçoit plus de correctifs de sécurité. Cette livraison respecte la limite actuelle des serveurs ; prévoir une version maintenue lorsque l’hébergeur la proposera.

## Ensuite, à chaque mise à jour

1. **Push sur GitHub** du dépôt, y compris `deploy/plesk/`.
2. Dans Plesk : **Pull Updates → Deploy Now**. Attendre la fin de la publication des fichiers.
3. Dans Node.js : **Restart**.

**Pour les modifications du code, des vues, du CSS et du JavaScript avec les mêmes dépendances : ces clics suffisent. Aucun build, aucune commande ni action supplémentaire de déploiement n’est nécessaire.**

**Exception :** si une mise à jour change les dépendances dans `package.json` ou `package-lock.json`, cliquer de nouveau sur **NPM Install** avant **Restart**. **Deploy Now** publie les fichiers ; il n’installe pas les dépendances tout seul lorsque les actions supplémentaires sont désactivées. Cette étape reste un bouton dans Plesk, pas une commande ni un build.

Vérification après démarrage :

- `https://votre-domaine/healthz` doit afficher `status: "ok"`, `databaseAvailable: true`, `adminAvailable: true`.
- `https://votre-domaine/admin` ouvre la connexion administrateur.

La production refuse explicitement de démarrer si MySQL ou les secrets obligatoires ne sont pas valides. La publication des fichiers ne configure pas les identifiants de votre hébergeur.

### Si Apache renvoie 403 et cherche un index dans public/

Le message `AH01276: Cannot serve directory .../public/: No matching DirectoryIndex` signifie qu’Apache traite la requête comme un accès au dossier statique. Ne pas ajouter un `index.html` qui masquerait le problème et laisserait les routes admin et newsletter inaccessibles.

La livraison inclut désormais l’entrée conventionnelle `app.js` pour la détection Passenger. Après **Pull Updates → Deploy Now**, choisir `app.js` comme **Application startup file**, puis cliquer sur **Restart App**. Aucun nouveau NPM Install n’est nécessaire pour ce changement.

Si Apache continue de servir le dossier statique, désactiver puis réactiver Node.js depuis ses boutons dans Plesk, pour recharger sa configuration. Vérifier à nouveau les dossiers et le fichier de démarrage. Si `/healthz` renvoie toujours une page Plesk 404 après ces réglages, l’hébergeur doit vérifier la configuration Apache/Passenger de ce domaine ; un ajout de fichier HTML ne corrige pas ce routage.

## Maintenir les sources et la livraison synchronisées

### Administration des tarifs, du pied de page et des e-mails

- **Tarifs** : tous les textes sont modifiables séparément en français et en anglais (titres, cartes/offres, prix par offre, listes, explications, FAQ et boutons), plus les deux grilles HTML. Les textes ordinaires sont affichés comme texte, sans HTML ; les grilles sont nettoyées. Un champ vide reprend son texte d’origine.
- **Paramètres → Liens / Pied de page** : e-mails, téléphone, adresse, WhatsApp, Facebook, LinkedIn, X, Instagram, YouTube, TikTok et Telegram. Les liens vides sont masqués.
- **Notifications contact** : enregistrer l’adresse destinataire, cocher l’activation, puis tester l’envoi.
- Configurer une fois les variables Node.js Plesk `SMTP_HOST`, `SMTP_PORT` (587 par défaut ou 465), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (adresse expéditrice autorisée). Ne pas mettre ces identifiants dans Git ni dans une conversation. Utiliser les paramètres SMTP de votre fournisseur de messagerie. Après modification des variables, cliquer sur **Restart**.
- Connexion chiffrée obligatoire : TLS sur 465, STARTTLS sur les autres ports. Le visiteur est en « Répondre à », jamais en expéditeur.
- La première activation n’envoie pas l’historique antérieur. Ensuite les notifications reprennent après une interruption, toutes les 30 secondes ; jusqu’à 5 tentatives espacées de 5 minutes. Le suivi affiche les 50 dernières notifications ; le bouton de relance remet les échecs en attente. Les demandes restent dans **Messages de contact** même si SMTP échoue. Une panne après acceptation SMTP peut exceptionnellement entraîner un doublon ; l’acceptation SMTP ne garantit pas la livraison en boîte de réception.
- Cette mise à jour ajoute **nodemailer** compatible Node.js 21.7.3 : cliquer sur **NPM Install une fois** après le pull. **Aucun build** n’est requis sur Plesk. Les prochaines modifications sans nouvelle dépendance conservent le parcours **Pull Updates → Deploy Now → Restart**.
- Les tables de suivi et la colonne du pays ISO sont créées automatiquement au démarrage, sans effacer les demandes existantes. L’utilisateur MySQL doit disposer des droits CREATE/ALTER pour cette mise à jour ; les anciennes demandes restent lisibles sans pays ISO.

La source reste `artifacts/bizconnectpay/`. Après une modification de cette source, préparer les fichiers **avant** le push (dans l’environnement de développement, jamais sur Plesk) :

```sh
pnpm --filter @workspace/bizconnectpay run prepare:plesk
# Seulement si les dépendances ont changé :
npm --prefix deploy/plesk install --package-lock-only --ignore-scripts --omit=dev
# Après une génération du verrouillage, normaliser les adresses pour Plesk :
pnpm --filter @workspace/bizconnectpay run prepare:plesk
pnpm --filter @workspace/bizconnectpay run check:plesk
```

Le dossier prêt à démarrer est déjà préparé pour cette livraison. Inclure ses modifications dans le même commit que les sources. `check:plesk` détecte les fichiers livrés désynchronisés, les différences de dépendances du verrouillage et les adresses de paquets internes non portables. Le script de préparation conserve les versions et empreintes npm du verrouillage, les éventuels secrets locaux et les dépendances déjà installées ; il normalise uniquement les adresses du registre dans la livraison externe.

Guide détaillé : `deploy/plesk/README.md`.

Documentation officielle :
- [Plesk : dépôt Git distant, Pull/Deploy et actions de déploiement](https://docs.plesk.com/en-US/obsidian/customer-guide/git-support/using-remote-git-hosting.75848/#enable-additional-deployment-actions)
- [Plesk : héberger une application Node.js](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/)
