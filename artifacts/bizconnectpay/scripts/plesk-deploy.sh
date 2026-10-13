#!/bin/sh
# Plesk additional deployment action, called once files have been published.
# This installs runtime dependencies only; it never builds the application.
set -eu

APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$APP_ROOT"
NODE_BIN_DIR=${1:-/opt/plesk/node/22/bin}

if [ ! -x "$NODE_BIN_DIR/node" ] || [ ! -f "$NODE_BIN_DIR/npm" ]; then
  echo "Node.js/npm introuvables dans le chemin configuré. Choisissez le chemin de la version Node.js activée dans Plesk. Si les actions Git sont chrootées, demandez à l’hébergeur de rendre ce runtime accessible." >&2
  exit 1
fi
export PATH="$NODE_BIN_DIR:$PATH"
node -e 'if(Number(process.versions.node.split(".")[0])<18){console.error("Node.js 18 minimum requis.");process.exit(1)}'

if [ ! -f package-lock.json ]; then
  echo "package-lock.json autonome manquant : poussez le dossier deploy/plesk complet depuis GitHub." >&2
  exit 1
fi
echo "Installation des dépendances de production — aucun build applicatif."
npm ci --omit=dev --no-audit --no-fund
node scripts/check.js
echo "Déploiement prêt. Cliquez sur Restart dans la rubrique Node.js de Plesk."
