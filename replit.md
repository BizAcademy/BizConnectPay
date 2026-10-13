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

## Contraintes du propriétaire

- Reproduire exactement le HTML fourni : design, textes, Poppins, couleurs, navigation par hash, responsive et sombre d’origine. Ne pas refaire le design.
- Le logo et l’icône base64 doivent être extraits tels quels, sans retouche.
- Aucune fonctionnalité Replit DB/Replit Auth dans l’application livrée ; stockage MySQL avec mysql2, rendu EJS, mot de passe admin local explicitement demandé.
- Sans MySQL, le mode développement indique la configuration manquante et ne simule ni inscription newsletter ni médias enregistrés.
- `reference/bizconnectpay.html` dans l’application est la référence immutable. Le thème public suit les préférences système, comme le fichier fourni.

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
