#!/bin/bash
# Launcher para Gastos Mensais V6
# Resolve problema de sandbox do Electron quando executado pelo GNOME

APP_IMAGE="/home/matheus-mendes/Área de trabalho/PROJETOS COOKING/controlGastosAPPv6/dist/Gastos Mensais V6-6.0.0.AppImage"

# Executar com flags corretas para evitar erro de sandbox
exec "$APP_IMAGE" --no-sandbox "$@"
