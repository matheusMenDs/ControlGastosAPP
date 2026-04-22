#!/bin/bash

# Script rápido para apenas testar o AppImage sem instalar

echo "🧪 Testando AppImage..."
echo ""

cd "/home/matheus-mendes/Área de trabalho/PROJETOS COOKING/controlGastosAPPv6"

if [ ! -f "dist/Gastos Mensais V6-6.0.0.AppImage" ]; then
    echo "❌ AppImage não encontrado!"
    echo "Execute primeiro: ./rebuild-and-install.sh"
    exit 1
fi

# Executar o AppImage diretamente
"dist/Gastos Mensais V6-6.0.0.AppImage" --no-sandbox
