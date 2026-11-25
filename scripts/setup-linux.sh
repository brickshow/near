#!/usr/bin/env sh
set -eu

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This setup helper requires Ubuntu or Debian with apt-get." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  curl \
  file \
  libayatana-appindicator3-dev \
  libclang-dev \
  libssl-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  pkg-config \
  wget

if [ ! -x "$HOME/.cargo/bin/cargo" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

echo "Linux build dependencies are ready. Run: npm run tauri dev"
