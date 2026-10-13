# BizConnectPay — Express, EJS et MySQL

La page publique provient du fichier `reference/bizconnectpay.html` fourni, sans refonte du design. Les logos sont les octets WebP d’origine, extraits en `public/assets/logo.webp` et `public/assets/icon.webp`. La police Poppins, les couleurs, les textes, les panneaux de démonstration, les huit pages par hash et les règles responsives/claires/sombres sont conservés.

**Ce projet administre une landing page, pas un moteur de paiement.** Le bouton d’inscription mène au lien renseigné dans l’administration ; les paiements représentés dans les panneaux d’origine sont les maquettes de référence, pas des transactions réelles.

## Contenu à déployer

**Déploiement GitHub → Plesk recommandé :** la version autonome est déjà présente et versionnée dans `deploy/plesk/` à la racine du dépôt. Configurer la racine applicative Plesk sur ce dossier, et la racine publique sur son sous-dossier `public/`. Après une installation initiale via le bouton **NPM Install**, les modifications du code se publient avec **Push GitHub → Pull Updates → Deploy Now → Restart**, sans commande, script de déploiement ni build sur Plesk. Ne pas activer les actions supplémentaires Git. Si les dépendances changent, utiliser de nouveau le bouton **NPM Install** avant de redémarrer. Voir `PLESK.md`.

```text
app.js                    entrée conventionnelle pour la détection Passenger, relais vers server.js
server.js                 point d’entrée CommonJS compatible Plesk/Passenger
src-server/               Express, MySQL, sessions, sécurité, routes
views/                    vues et fragments EJS publics et administrateur
public/assets/            logos WebP immuables
public/css/               CSS public d’origine et CSS admin séparé
public/js/                navigation par hash, newsletter et aperçu des uploads
schema.sql                tables créées automatiquement au démarrage
.env.example              configuration sans aucun secret
reference/bizconnectpay.html  référence d’origine, non servie sur le site
```

Aucune dépendance fonctionnelle à Replit DB, Replit Auth, un connecteur Replit ou un stockage propriétaire. Les octets médias et les paramètres sont stockés dans **votre MySQL**, via `mysql2/promise`.

## Prérequis et installation locale

- Version cible des serveurs : **Node.js 21.7.3**. Le code conserve un minimum compatible de 18, mais la configuration Plesk cible 21.7.3 ; aucune version supérieure n’est requise. Node.js 21 est hors support officiel : prévoir une version maintenue lorsque l’hébergeur le permettra.
- MySQL 5.7+/8 ou MariaDB 10.3+, avec base et utilisateur déjà créés.
- Un mot de passe administrateur entre 12 et 72 octets UTF-8.
- Une clé `SESSION_SECRET` aléatoire d’au moins 32 caractères.

Dans le dossier autonome exporté :

```sh
npm install --omit=dev
cp .env.example .env
# Compléter .env localement, sans envoyer les mots de passe dans une conversation.
npm start
```

`start` vaut exactement `node server.js`. Aucun build frontend ni pnpm n’est nécessaire sur Plesk. `app.js` est l’entrée conventionnelle recommandée dans le panneau Node.js de Plesk pour la détection Passenger ; il charge `server.js`. Ce dernier est un point d’entrée CommonJS qui importe les modules ESM internes dynamiquement, pour éviter l’erreur Passenger `ERR_REQUIRE_ESM`.

Dans le projet de développement pnpm :

```sh
pnpm --filter @workspace/bizconnectpay run typecheck
pnpm --filter @workspace/bizconnectpay run package:plesk
```

La deuxième commande crée `generated-artifacts/bizconnectpay-plesk.zip`, sans secrets, sans `node_modules` ni plugins de développement, pour une installation manuelle alternative. Pour GitHub → Plesk, pousser le dépôt incluant `deploy/plesk/` et suivre `PLESK.md`. Plesk exécute uniquement l’application autonome, **pas le monorepo**.

## Variables d’environnement

| Variable | Utilisation |
|---|---|
| `NODE_ENV` | `production` sur Plesk, pour les cookies sécurisés et les en-têtes HTTPS |
| `PORT` | Port de l’application fourni par l’hébergement ou configuré dans Plesk |
| `DB_HOST` | Hôte MySQL indiqué par Plesk |
| `DB_PORT` | Port MySQL, `3306` par défaut |
| `DB_USER` | Utilisateur MySQL dédié |
| `DB_PASSWORD` | Mot de passe de cet utilisateur |
| `DB_NAME` | Nom exact de la base, y compris tout préfixe imposé par Plesk |
| `SESSION_SECRET` | Clé aléatoire longue, propre à ce site |
| `ADMIN_PASSWORD` | Mot de passe de `/admin` |
| `IMAGE_MAX_MB` | Taille maximale image en Mo, `5` par défaut |
| `VIDEO_MAX_MB` | Taille maximale vidéo en Mo, `50` par défaut |
| `SESSION_HOURS` | Durée de session, `8` heures par défaut |
| `TRUST_PROXY` | `1` derrière le proxy Plesk ; `0` pour accès direct sans proxy |
| `BASE_PATH` | `/` au domaine racine ; autre préfixe possible si le proxy le préserve |
| `SITE_PREVIEW` | `0` normalement ; `1` uniquement en développement pour consulter le site même si MySQL est absent ou inaccessible |

Les variables Plesk priment sur le fichier `.env`. Celui-ci se trouve dans la racine **de l’application**, jamais dans la racine publique. Ne pas enregistrer les secrets dans Git.

Le mode aperçu n’invente aucune donnée : sans MySQL, seule la page publique d’origine est affichée, `/admin` indique la configuration manquante et la newsletter renvoie explicitement HTTP 503. Avec `SITE_PREVIEW=1` en développement, une erreur de connexion MySQL (adresse inaccessible, connexion refusée, accès refusé ou base inexistante) laisse également le site public disponible, mais désactive toutes les fonctions dépendantes de la base. Le code de l’erreur, sans identifiants, est signalé dans les journaux et sur `/admin` ; `/healthz` indique `status: "preview"` et `databaseAvailable: false`. Cela permet de consulter le site pendant la configuration du serveur distant, sans annoncer de fausse inscription réussie. Les erreurs de schéma ou de programmation ne sont pas masquées. En production, le serveur **refuse de démarrer** avec une configuration incomplète ou une connexion MySQL défaillante, même si `SITE_PREVIEW=1`. Les variables ne sont pas fournies dans les livrables.

## Déploiement Plesk chez Cybrancee

Les libellés peuvent légèrement varier selon la version Plesk et votre offre Cybrancee. L’extension **Node.js** doit être disponible pour le domaine.

### 1. Préparer les fichiers

1. Décompresser le ZIP autonome.
2. Dans **Sites Web & Domaines → Gestionnaire de fichiers**, déposer le contenu dans un dossier applicatif, par exemple `bizconnectpay/`.
3. Ne jamais mettre `.env`, `schema.sql`, `src-server/` ou `views/` dans une racine de documents accessible directement.
4. Le dossier `public/` ne contient que les éléments publics et ne doit pas contenir d’ancien `index.html` qui remplacerait l’application dynamique.

### 2. Créer MySQL et son utilisateur

1. Ouvrir **Bases de données → Ajouter une base de données**.
2. Choisir le serveur MySQL/MariaDB, le nom de base et le domaine.
3. Créer un utilisateur dédié avec un mot de passe fort et l’associer à cette base uniquement.
4. Autoriser `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` sur cette base. `CREATE` est nécessaire pour l’initialisation automatique des tables.
5. Reporter dans les variables les valeurs exactes de `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Si le serveur est externe, autoriser l’adresse du serveur applicatif sur MySQL.

Les tables `media`, `settings`, `subscribers` sont créées automatiquement au premier démarrage. La table supplémentaire `admin_sessions` conserve les sessions Express dans MySQL et évite le MemoryStore en production. `schema.sql` peut aussi être importé dans phpMyAdmin ; il n’efface aucune table existante.

### 3. Activer l’application Node.js

Dans **Sites Web & Domaines → votre domaine → Node.js** :

1. Choisir **Node.js 21.7.3**, version disponible sur les serveurs du propriétaire.
2. Définir la **racine de l’application** sur le dossier `bizconnectpay/` contenant `package.json` et `server.js`.
3. Définir la **racine des documents** sur son sous-dossier `bizconnectpay/public/`.
4. Définir le **fichier de démarrage** sur `app.js` (relais vers `server.js`).
5. Choisir le mode **production**.
6. Ajouter les variables d’environnement de la table ci-dessus. `BASE_PATH=/`, `TRUST_PROXY=1`, `SITE_PREVIEW=0`. Définir `PORT` conformément à votre configuration Node.js Plesk (par exemple `3000` si votre hébergeur demande un port numérique).
7. Cliquer sur **Activer Node.js**, puis **Installer NPM / NPM install**. Il n’y a pas de commande de build à exécuter.
8. Cliquer sur **Redémarrer l’application** après chaque changement de variable.

Le serveur écoute sur la valeur de `PORT`. Ne pas lancer une deuxième instance via SSH si Passenger gère déjà l’application. Si la rubrique Node.js n’existe pas, faire activer cette extension pour votre offre auprès de l’hébergeur.

### 4. Configurer SSL et les limites HTTP

1. Installer un certificat pour le domaine depuis **Certificats SSL/TLS**, par exemple Let’s Encrypt.
2. Activer la redirection HTTP vers HTTPS dans **Paramètres d’hébergement**.
3. Accéder à `/admin` en **HTTPS** : les cookies administrateur sont `Secure` en production. Une connexion uniquement HTTP ne gardera pas la session.
4. Les limites du proxy doivent accepter **un peu plus de 50 Mo** pour inclure les en-têtes multipart. Pour nginx, par exemple `client_max_body_size 60m;`, si votre compte autorise les directives supplémentaires. Faire ajuster aussi Apache/Passenger si une limite plus basse est configurée.
5. MySQL doit accepter la taille de l’upload : `max_allowed_packet` **au moins 64M** pour des vidéos de 50 Mo, ou plus si vous augmentez `VIDEO_MAX_MB`. Le gestionnaire du serveur MySQL doit modifier ce réglage ; un compte Plesk partagé peut ne pas avoir ce droit.
6. Redémarrer/reconnecter l’application après changement MySQL : les connexions existantes peuvent conserver l’ancienne limite.

### 5. Configurer le site

1. Ouvrir `https://votre-domaine/admin`.
2. Saisir le mot de passe `ADMIN_PASSWORD`.
3. **Médias** : téléverser une image/vidéo, remplacer, prévisualiser, ou supprimer pour retrouver le panneau d’origine.
4. **Paramètres** : lien d’inscription, e-mail support, WhatsApp, réseaux sociaux et informations légales.
5. **Tarifs** : saisir du HTML (tableaux, titres, listes, liens) ; les scripts, événements inline, iframes et éléments non autorisés sont retirés.
6. **Newsletter** : voir les inscrits par pages de 50 et exporter un CSV UTF-8 compatible Excel.

### 6. Contrôles après mise en service

- `/healthz` doit indiquer `databaseAvailable: true` et `adminAvailable: true`.
- Contrôler l’inscription newsletter, puis son apparition dans l’admin.
- Confirmer que la déconnexion interdit l’accès aux pages administrateur.
- Téléverser une petite image, puis une vidéo ; vérifier la lecture et le déplacement dans la vidéo.
- Supprimer un média et vérifier que le panneau original réapparaît.
- Renseigner les informations légales et contrôler les huit pages par hash.
- Sauvegarder régulièrement MySQL : les blobs, les paramètres, les inscrits et les sessions y sont conservés. Aucun dossier d’uploads ne contient de copie des médias.

## Routes et sécurité

- `GET /` : site EJS avec hash `#accueil`, `#services`, `#tarifs`, `#apropos`, `#cgu`, `#confidentialite`, `#mentions`, `#cookies`.
- `GET /media/:id` : type MIME vérifié, ETag, cache immuable un an, `Accept-Ranges`, réponses 206/416 et requêtes HEAD/conditionnelles. MySQL ne lit que les octets demandés par une plage.
- `POST /api/subscribe` : e-mail validé et normalisé, SQL paramétré, inscription idempotente sans doublons, limitation à 10 demandes par 15 minutes par IP.
- `/admin` : sessions MySQL, cookies HttpOnly/SameSite/Secure, bcrypt, régénération de session à la connexion, CSRF sur toutes les actions et limitation des tentatives.
- Uploads en mémoire via multer, signature binaire via `file-type` (pas l’extension ni le type déclaré par le navigateur), 5 Mo/50 Mo par défaut. Formats SVG/HTML interdits.
- Réglages échappés dans les modèles EJS ; tarifs nettoyés à l’enregistrement **et** à l’affichage.
- Helmet/CSP autorise Google Fonts. Les styles inline d’origine restent autorisés pour garder le rendu exact, mais aucun script inline n’est autorisé.
- Les exportations CSV neutralisent les cellules susceptibles d’être interprétées comme des formules.

La limite de login est en mémoire et convient à une instance unique Plesk ; plusieurs instances nécessiteraient un limiteur partagé. Les sessions elles-mêmes sont persistantes dans MySQL. Le mot de passe est haché avec bcrypt au démarrage, jamais stocké en clair dans MySQL.

## Dépannage

- **502 / impossible de démarrer** : consulter les journaux Node.js/Plesk, vérifier les variables, les droits MySQL, `PORT`, le chemin et l’installation npm.
- **ER_ACCESS_DENIED_ERROR / ECONNREFUSED** : vérifier l’utilisateur, la base, l’hôte, le port et l’autorisation réseau.
- **max_allowed_packet** : le message admin explique le réglage MySQL ; diminuer le fichier ou augmenter la limite.
- **413 avant l’admin** : limite nginx/Apache, pas celle de multer.
- **Connexion admin qui revient au formulaire** : vérifier HTTPS, `NODE_ENV=production`, le proxy de confiance et la persistance MySQL.
- **Styles ou logo absents** : vérifier la racine de documents `public/` et `BASE_PATH`.
- **Champs jaunes visibles** : renseigner les paramètres légaux, sans modifier les vues.

## Documentation Plesk consultée

- [Hébergement d’applications Node.js](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/)
- [Compatibilité ESM/Passenger et import dynamique](https://support.plesk.com/hc/en-us/articles/12389037025431-A-Node-js-app-hosted-in-Plesk-is-not-working-require-of-ES-Module-is-not-supported)

L’application n’a pas été déployée sur votre compte Cybrancee par ce livrable. Les vérifications MySQL et administrateur réelles nécessitent vos variables de connexion.
