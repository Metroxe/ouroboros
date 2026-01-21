#!/bin/bash

# =============================================================================
# Oroboros Build Script
# Compiles TypeScript scripts to standalone Bun executables
# =============================================================================
#
# USAGE:
#   ./build.sh [options]
#
# OPTIONS:
#   -v, --verbose     Show detailed output
#   -h, --help        Show this help message
#
# OUTPUT:
#   Compiled binaries are placed in ../oroboros/scripts/
#
# =============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../oroboros/scripts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            head -20 "$0" | grep -E "^#" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check for bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed${NC}"
    echo "Install Bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "Building oroboros scripts..."
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$SCRIPT_DIR"
    bun install
    echo ""
fi

# Build each script
build_script() {
    local name=$1
    local source="$SCRIPT_DIR/scripts/${name}.ts"
    local output="$OUTPUT_DIR/$name"
    
    if [ ! -f "$source" ]; then
        echo -e "${YELLOW}Warning: $source not found, skipping${NC}"
        return
    fi
    
    if [ "$VERBOSE" = true ]; then
        echo "Building: $source -> $output"
    fi
    
    if bun build --compile --target=bun-darwin-arm64 "$source" --outfile "$output" 2>&1; then
        echo -e "${GREEN}✓${NC} Built: $name"
    else
        echo -e "${RED}✗${NC} Failed: $name"
        exit 1
    fi
}

# Build all scripts in the scripts directory
cd "$SCRIPT_DIR"
for script in scripts/*.ts; do
    if [ -f "$script" ]; then
        name=$(basename "$script" .ts)
        build_script "$name"
    fi
done

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo "Output: $OUTPUT_DIR"
