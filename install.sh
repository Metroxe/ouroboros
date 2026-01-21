#!/bin/bash
# =============================================================================
# Oroboros Installer
# 
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash
#   
# Or with a specific version:
#   curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash -s -- v1.0.0
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="Metroxe/ouroboros"
INSTALL_DIR="./oroboros"

echo ""
echo -e "${BLUE}╭─────────────────────────────────────╮${NC}"
echo -e "${BLUE}│${NC}         ${GREEN}oroboros installer${NC}         ${BLUE}│${NC}"
echo -e "${BLUE}╰─────────────────────────────────────╯${NC}"
echo ""

# Check for existing installation
if [ -f "$INSTALL_DIR/.version" ]; then
    CURRENT_VERSION=$(cat "$INSTALL_DIR/.version")
    echo -e "Found existing installation: ${YELLOW}v${CURRENT_VERSION}${NC}"
    MODE="update"
else
    echo "No existing installation found."
    MODE="install"
fi

# Determine version to install
if [ -n "$1" ]; then
    VERSION="$1"
    echo -e "Installing specified version: ${GREEN}${VERSION}${NC}"
else
    echo "Fetching latest version..."
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$VERSION" ]; then
        echo -e "${RED}Error: Could not fetch latest version${NC}"
        echo "You may need to specify a version: ./install.sh v1.0.0"
        exit 1
    fi
    echo -e "Latest version: ${GREEN}${VERSION}${NC}"
fi

# Check architecture
ARCH=$(uname -m)
OS=$(uname -s)

if [ "$OS" != "Darwin" ] || [ "$ARCH" != "arm64" ]; then
    echo -e "${YELLOW}Warning: This installer is optimized for macOS ARM64${NC}"
    echo "Detected: $OS $ARCH"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/oroboros-darwin-arm64.tar.gz"

echo ""
echo "Downloading oroboros ${VERSION}..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Download and extract
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_DIR/oroboros.tar.gz"; then
    echo -e "${RED}Error: Failed to download release${NC}"
    echo "URL: $DOWNLOAD_URL"
    exit 1
fi

echo "Extracting..."
tar -xzf "$TEMP_DIR/oroboros.tar.gz" -C "$TEMP_DIR"

# Run the install script from the extracted package
echo ""
if [ -x "$TEMP_DIR/oroboros/scripts/install" ]; then
    "$TEMP_DIR/oroboros/scripts/install" .
else
    echo -e "${YELLOW}Warning: Compiled installer not found, using fallback${NC}"
    
    # Fallback: manual file copy
    mkdir -p "$INSTALL_DIR/prompts" "$INSTALL_DIR/reference" "$INSTALL_DIR/scripts" "$INSTALL_DIR/epics"
    
    # Copy framework files (always overwrite)
    cp -r "$TEMP_DIR/oroboros/prompts/"* "$INSTALL_DIR/prompts/" 2>/dev/null || true
    cp -r "$TEMP_DIR/oroboros/scripts/"* "$INSTALL_DIR/scripts/" 2>/dev/null || true
    cp "$TEMP_DIR/oroboros/.version" "$INSTALL_DIR/.version" 2>/dev/null || true
    
    # Copy scaffold files (only if missing)
    [ ! -f "$INSTALL_DIR/reference/epic-index.md" ] && cp "$TEMP_DIR/oroboros/reference/epic-index.md" "$INSTALL_DIR/reference/" 2>/dev/null || true
    [ ! -f "$INSTALL_DIR/reference/gotchas.md" ] && cp "$TEMP_DIR/oroboros/reference/gotchas.md" "$INSTALL_DIR/reference/" 2>/dev/null || true
    
    # Create .gitkeep in epics
    touch "$INSTALL_DIR/epics/.gitkeep"
    
    NEW_VERSION=$(cat "$INSTALL_DIR/.version")
    echo ""
    if [ "$MODE" = "update" ]; then
        echo -e "${GREEN}✓ Updated oroboros to v${NEW_VERSION}${NC}"
    else
        echo -e "${GREEN}✓ Installed oroboros v${NEW_VERSION}${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC} Run ${BLUE}oroboros/prompts/create-mission.md${NC} to get started."
echo ""
