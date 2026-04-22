#!/bin/bash
# Script para executar o Gastos Mensais V6

APP_DIR="/home/matheus-mendes/Área de trabalho/PROJETOS COOKING/controlGastosAPPv6/dist"
APP_NAME="Gastos Mensais V6-6.0.0.AppImage"
APP_PATH="$APP_DIR/$APP_NAME"

# Verificar se já há uma instância rodando
if pgrep -f "gastos-mensais-v6" > /dev/null; then
    echo "Uma instância já está rodando. Focando janela existente..."
    # Tentar focar a janela existente
    wmctrl -a "Gastos Mensais" 2>/dev/null || xdotool search --name "Gastos Mensais" windowactivate 2>/dev/null
    exit 0
fi

# Verificar se a porta 3001 está em uso
if lsof -i :3001 > /dev/null 2>&1; then
    echo "Porta 3001 em uso. Limpando processos antigos..."
    pkill -9 -f "gastos-mensais-v6"
    sleep 1
fi

# Ir para o diretório do app e executar
cd "$APP_DIR" || exit 1
exec "$APP_PATH" "$@"
