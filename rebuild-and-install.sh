#!/bin/bash

echo "🚀 Iniciando processo de build e instalação do Gastos Mensais V6..."
echo ""

# 1. Fechar Electron
echo "1️⃣ Fechando instâncias do Electron..."
pkill -f electron
sleep 2

# 2. Navegar para o diretório do projeto
cd "/home/matheus-mendes/Área de trabalho/PROJETOS COOKING/controlGastosAPPv6"

# 3. Fazer o build
echo "2️⃣ Fazendo build do AppImage..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro no build! Verifique os erros acima."
    exit 1
fi

# 4. Verificar se o AppImage foi gerado
if [ ! -f "dist/Gastos Mensais V6-6.0.0.AppImage" ]; then
    echo "❌ AppImage não foi gerado!"
    exit 1
fi

echo "✅ AppImage gerado com sucesso!"

# 5. Dar permissões ao .desktop
echo "3️⃣ Dando permissões executáveis..."
chmod +x "./gastos-mensais-v6.desktop"

# 6. Copiar para o sistema
echo "4️⃣ Instalando no sistema..."
cp "./gastos-mensais-v6.desktop" ~/.local/share/applications/

# 7. Atualizar databases
echo "5️⃣ Atualizando databases do sistema..."
update-desktop-database ~/.local/share/applications/
gtk-update-icon-cache -f ~/.local/share/icons/hicolor/ 2>/dev/null || true

echo ""
echo "✅ =========================================="
echo "✅ CONCLUÍDO COM SUCESSO!"
echo "✅ =========================================="
echo ""
echo "📱 Procure por 'Gastos Mensais V6' no menu de aplicativos."
echo "⭐ Você pode adicionar aos favoritos!"
echo ""
echo "ℹ️  AppImage localizado em:"
echo "   dist/Gastos Mensais V6-6.0.0.AppImage"
echo ""
