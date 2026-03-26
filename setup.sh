#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Assistansportal — Setup            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Check Python 3 ──────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "❌  Python 3 not found."
  echo "    Install it from: https://www.python.org/downloads/"
  exit 1
fi
PY=$(python3 --version)
echo "✓  $PY found"

# ── Create virtual environment ───────────────────────────────
if [ ! -d "venv" ]; then
  echo "→  Creating virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
echo "✓  Virtual environment ready"

# ── Install Python packages ──────────────────────────────────
echo "→  Installing packages (this may take a minute)..."
pip install --quiet --upgrade pip
pip install --quiet \
  flask \
  flask-cors \
  pypdf \
  google-auth \
  google-auth-oauthlib \
  google-auth-httplib2 \
  google-api-python-client

echo "✓  All packages installed"

# ── Create forms directory placeholder ───────────────────────
mkdir -p forms uploads db

if [ ! -f "forms/fk3057.pdf" ]; then
  echo ""
  echo "⚠️   FK 3057 form not found."
  echo "    Download it and place it at: forms/fk3057.pdf"
  echo "    URL: https://www.forsakringskassan.se/download/18.398e2a521762d5349875c9/..."
fi

echo ""
echo "✅  Setup complete!"
echo ""
echo "   To start the app:"
echo "   ./start.sh"
echo ""
