#!/bin/bash
source venv/bin/activate
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Assistansportal — Starting         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  App running at: http://localhost:5050"
echo "  Press Ctrl+C to stop"
echo ""
python3 server.py
