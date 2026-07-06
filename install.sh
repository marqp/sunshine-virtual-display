#!/bin/bash
set -euo pipefail

# ==============================================================================
# Sunshine Virtual Display (macOS) - Universal Installer
# ==============================================================================
# This script automatically detects your architecture, fetches the latest 
# release from GitHub, and installs the standalone binary to /usr/local/bin.
# ==============================================================================

# ANSI Color Codes for terminal UI
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper to print steps
info() {
    echo -e "${CYAN}==>${NC} $1"
}

success() {
    echo -e "${GREEN}SUCCESS:${NC} $1"
}

error() {
    echo -e "${RED}ERROR:${NC} $1"
    exit 1
}

# 1. Architecture Detection
info "Detecting system architecture..."
ARCH_RAW=$(uname -m)

if [ "$ARCH_RAW" == "arm64" ]; then
    ARCH="arm64"
elif [ "$ARCH_RAW" == "x86_64" ]; then
    ARCH="x64"
else
    error "Unsupported architecture: $ARCH_RAW. This tool is for macOS (arm64/x86_64)."
fi

success "Architecture detected: $ARCH"

# 2. Fetch Latest Release Metadata
info "Fetching latest release information from GitHub..."
REPO="marqp/sunshine-virtual-display"
RELEASE_API="https://api.github.com/repos/$REPO/releases/latest"

# Get the JSON response from GitHub API
RELEASE_DATA=$(curl -sSL "$RELEASE_API")

if [ -z "$RELEASE_DATA" ]; then
    error "Could not connect to GitHub API. Please check your internet connection."
fi

# Validate that the response is a valid release (not an API error page)
if ! echo "$RELEASE_DATA" | grep -q '"tag_name"'; then
    error "GitHub API returned an unexpected response. The repository may not have any releases yet."
fi

# 3. Parse Download URL for the detected architecture
# We look for assets containing "sunshine-vd-macos-[arch]"
DOWNLOAD_URL=$(echo "$RELEASE_DATA" | grep "browser_download_url" | grep "sunshine-vd-macos-$ARCH" | cut -d '"' -f 4 | head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
    error "Could not find a release binary matching your architecture ($ARCH) in the latest release."
fi

info "Found latest binary: $(basename "$DOWNLOAD_URL")"

# 4. Download and Install
TMP_DIR="/tmp/sunshine-vd-install"
mkdir -p "$TMP_DIR"
TMP_BIN="$TMP_DIR/sunshine-vd"

info "Downloading binary to temporary directory..."
if ! curl -L "$DOWNLOAD_URL" -o "$TMP_BIN"; then
    error "Failed to download the binary."
fi

info "Installing to /usr/local/bin/sunshine-vd (requires sudo)..."
if ! sudo mv "$TMP_BIN" "/usr/local/bin/sunshine-vd"; then
    error "Failed to move binary to /usr/local/bin. Ensure you have sudo permissions."
fi

info "Applying execution permissions..."
if ! sudo chmod +x "/usr/local/bin/sunshine-vd"; then
    error "Failed to apply permissions to the binary."
fi

# 5. Cleanup and Finalize
rm -rf "$TMP_DIR"

echo -e "\n${GREEN}======================================================================${NC}"
success "Sunshine Virtual Display has been installed successfully!"
echo -e "You can now run the tool from anywhere by typing: ${CYAN}sunshine-vd${NC}"
echo -e "For automated sessions, use: ${CYAN}sunshine-vd --ci${NC}"
echo -e "${GREEN}======================================================================${NC}\n"
