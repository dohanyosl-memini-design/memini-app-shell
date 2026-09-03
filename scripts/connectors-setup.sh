#!/usr/bin/env bash
# connectors.hu CLI telepítő – átlátható, repóban követett változat.
#
# Mit csinál: letölti a `connectors` bináris CLI-t a hivatalos GitHub release-ből
# (Szotasz/connectors-cli) a ~/.local/bin mappába. Ugyanaz, mint a hivatalos
# `curl -fsSL https://connectors.hu/install.sh | sh`, de itt a forráskódban
# olvasható, MIT futtatsz — nem egy távoli szkriptet csövezünk a shellbe.
#
# Használat:
#   bash scripts/connectors-setup.sh          # telepítés
#   npm run connectors:setup                  # ugyanez npm-mel
#
# A tokent NEM ez a szkript állítja be. Miután lefutott, add meg a saját
# környezetedben (soha nem a repóban):
#   export CONNECTORS_HU_TOKEN=cnk_...        # https://connectors.hu/dashboard/api-keys
#
# Részletek: docs/connectors-hu.md
set -euo pipefail

REPO="Szotasz/connectors-cli"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64)        ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Nem támogatott architektúra: $ARCH" >&2; exit 1 ;;
esac

case "$OS" in
  darwin|linux) ;;
  *) echo "Nem támogatott OS: $OS" >&2; exit 1 ;;
esac

BINARY="connectors-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"

echo "connectors letöltése (${OS}/${ARCH})…"
mkdir -p "$INSTALL_DIR"
curl -fsSL "$URL" -o "$INSTALL_DIR/connectors"
chmod +x "$INSTALL_DIR/connectors"

echo ""
echo "✓ connectors telepítve ide: ${INSTALL_DIR}/connectors"
echo ""

# PATH-ellenőrzés
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "⚠ A ${INSTALL_DIR} nincs a \$PATH-on."
    echo "  Add hozzá a ~/.zshrc vagy ~/.bashrc fájlhoz:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    ;;
esac

# Token-ellenőrzés – csak figyelmeztetés, nem állítunk be titkot.
if [ -z "${CONNECTORS_HU_TOKEN:-}" ]; then
  echo "Következő lépés – token beállítása (a saját környezetedben, NEM a repóban):"
  echo "    export CONNECTORS_HU_TOKEN=cnk_...   # https://connectors.hu/dashboard/api-keys"
  echo ""
fi

echo "Kipróbálás:"
echo "    connectors sync"
echo "    connectors billingo list-documents --top 5"
