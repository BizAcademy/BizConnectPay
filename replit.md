# BizConnectPay

Landing page fournie par le propriétaire, reproduite fidèlement dans une application Express/EJS avec administration et stockage MySQL, destinée à Plesk/Cybrancee.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Application métier : `pnpm --filter @workspace/bizconnectpay run dev`.
- Configuration métier : `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `ADMIN_PASSWORD`.
- Lire `artifacts/bizconnectpay/README.md` pour l’export autonome et Plesk. Les paquets Postgres/React du squelette ne sont pas utilisés par BizConnectPay.
- L’hébergement cible est Plesk, pas Replit. Lire `PLESK.md` pour GitHub → Pull Updates → Deploy Now → Restart, sans build sur Plesk.
- Le propriétaire refuse toute commande ou script de déploiement à configurer dans Plesk. Utiliser les boutons natifs uniquement ; NPM Install initialement, et à nouveau seulement si les dépendances changent.
- Le propriétaire utilise Node.js **21.7.3** sur tous ses serveurs ; c’est la version maximale disponible. Ne pas imposer Node.js 22 ou 24 à la livraison Plesk.
- Plesk : entrée recommandée `app.js`, relais CommonJS vers `server.js`, pour la détection conventionnelle de Passenger ; `npm start` reste `node server.js`.
- Après toute modification métier, exécuter `pnpm --filter @workspace/bizconnectpay run prepare:plesk` puis `check:plesk` et inclure `deploy/plesk/` dans le commit. Actualiser le verrouillage npm autonome si les dépendances changent.
- Les médias MySQL gardent leur original. Fournir des variantes responsive allégées aux visiteurs, conserver les GIF animés et prioriser le visuel d’accueil. Sharp est compatible Node.js 21.7.3 ; son ajout nécessite NPM Install une fois dans Plesk, sans build applicatif.

## Contraintes du propriétaire

- Présentation inspirée de https://cartevo.co/fr, conserver l’identité BizConnectPay : logo, Poppins, bleu/cyan/vert, fonds blancs et responsive. Navigation publique par URL propres et rendu serveur pour Google ; les anciens liens par hash restent compatibles. Sur ordinateur, logo et Accueil / Tarifs / Contact à gauche, Se connecter (`login_url`), Commencer bleu (`signup_url`) et FR/EN à droite. Sur mobile : hamburger accessible avec Accueil / Contact / Tarifs, connexion, inscription et langue. La page Services et son contenu sont supprimés à la demande du propriétaire ; ne pas réintroduire son menu ni ses liens. Les solutions présentées sur l’accueil restent présentes. Lien client absent = contrôle désactivé, jamais de fausse destination ni de connexion admin.
- Le logo et l’icône base64 doivent être extraits tels quels, sans retouche.
- Le propriétaire souhaite du motion design sur toute la page publique ; conserver des animations fluides sur mobile et respecter la préférence de réduction des animations.
- Les cinq visuels (accueil, IN, OUT, Link, Virtual) sont configurables depuis l’admin et entrent horizontalement depuis leur côté. Sur ordinateur, le visuel d’accueil est à gauche du titre.
- Réduire les espaces blancs entre les sections : la demande de hauteur plein écran pour « Simple. Rapide. Sécurisé. » est remplacée par une hauteur adaptée au contenu. Conserver son grand visuel configurable. La section publique « Recevez nos actualités » est supprimée.
- Les quatre solutions sont présentées sur une seule rangée dans un carrousel, une solution à la fois, avec passage automatique à la suivante toutes les 5 secondes.
- Pied de page inspiré du modèle fourni : fond blanc, colonnes compactes, contacts configurés et texte légal intégral fourni par le propriétaire ; ne pas inventer de coordonnées ni de certification.
- La page Tarifs doit rester facile à retrouver depuis l’en-tête, l’accueil et le pied de page.
- Les tarifs HTML personnalisés et les descriptions d’images ont des champs anglais séparés pour éviter d’inventer une traduction de conditions financières administrées.
- Les langues FR/EN affichent respectivement le drapeau français et le drapeau anglais (croix de Saint-Georges), pas le drapeau britannique. Les pays du formulaire ont des drapeaux locaux et sont sélectionnables dans l’admin ; une sélection vide doit rester vide, jamais réactiver tous les pays.
- Tout le site public (8 pages, en-tête, pied de page avec texte légal intégral, contact, erreurs publiques) est bilingue français/anglais : chaînes source françaises via `t()` dans les EJS, catalogues `public/locales/en*.json` (clés = français exact, valeurs = traductions). Ne pas traduire les valeurs envoyées au serveur (secteurs, indicatifs), seulement leurs libellés. L’admin reste en français.
- Le propriétaire veut modifier tous les textes des tarifs dans l’admin, dans chaque langue, pas seulement la grille : titres, offres, prix, explications, FAQ et boutons. Il veut aussi configurer les contacts et réseaux du pied de page depuis l’admin.
- Les demandes Contact sont conservées en MySQL et peuvent être notifiées par SMTP vers une adresse choisie dans l’admin. Les identifiants SMTP restent dans les variables serveur Plesk, jamais dans les formulaires ni les réglages MySQL. **Pourquoi :** hébergement autonome Plesk et conservation des demandes même si la messagerie échoue. La file persistante permet les reprises ; ne jamais présenter un simple enregistrement comme un e-mail délivré.
- La page Contact suit le modèle https://cartevo.co/fr/contact : photo à gauche et formulaire à droite sur ordinateur, adapté au mobile et aux quatre services BizConnectPay, sans copier la marque concurrente ni sa certification.
- Aucune fonctionnalité Replit DB/Replit Auth dans l’application livrée ; stockage MySQL avec mysql2, rendu EJS, mot de passe admin local explicitement demandé.
- Sans MySQL, le mode développement indique la configuration manquante et ne simule ni inscription newsletter ni médias enregistrés.
- `reference/bizconnectpay.html` dans l’application est la référence immutable. Le site public doit rester blanc, indépendamment du thème système, conformément au changement demandé par le propriétaire.

## Stack du squelette (non utilisée par l’application métier)

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Exigences de mise en page (permanentes)

- Correction répétée du propriétaire : « Réinventer le paiement, propulser votre croissance » et « Simple. Rapide. Sécurisé. » ne doivent JAMAIS être regroupées dans un seul carrousel. Chacune reste sa PROPRE section (titre/intro fixes, empilées verticalement normalement), avec son PROPRE carrousel horizontal indépendant pour ses cartes (avantages / étapes), défilement automatique toutes les 5 s. Les cartes restent sur UNE rangée horizontale sur ordinateur ET sur smartphone, jamais empilées (sans JS : rangée à défilement horizontal). On fait défiler les cartes, pas les sections. Conserver textes, stats +20 / 4 et visuel admin simple_visual. Implémentation : `[data-car][data-car-cards]` dans `public/js/carousel.js` (pas d’une carte), nombre visible via `--vis` dans `public/css/vx.css`.
- La page `/tarifs` conserve l’identité existante et affiche uniquement les prix demandés par le propriétaire : PAYIN 5 %, PAYOUT 3,5 %, première carte Visa 2 000 FCFA (équivalent indicatif 3 USD), cartes supplémentaires 1 800 FCFA. Il s’agit uniquement de l’affichage, sans changement des transactions.

## Référencement des pages publiques

- Domaine officiel confirmé par le propriétaire : `https://bizconnectpay.com`.
- Les 8 pages publiques ont des URL françaises stables et des variantes anglaises sous `/en`. Le serveur ne renvoie que le contenu de la page demandée, visible sans JavaScript.
- Les liens internes, titres, descriptions, canoniques et variantes linguistiques suivent ces URL ; `/sitemap.xml` liste les 16 variantes. Les anciens liens `/#tarifs`, etc. sont redirigés côté navigateur.
- L’aperçu de développement reste non indexable. En production, seules les pages publiques sont proposées à Google ; l’administration, les endpoints techniques et les erreurs sont exclus.
- Vérification dédiée : `node artifacts/bizconnectpay/scripts/check-seo.js`. Après mise en ligne par le propriétaire, vérifier le domaine dans Google Search Console et soumettre `https://bizconnectpay.com/sitemap.xml`. La décision et les délais d’indexation appartiennent à Google.
