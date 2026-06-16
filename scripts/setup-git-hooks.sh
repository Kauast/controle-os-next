#!/bin/bash

# Setup de Git Hooks
# Execute uma vez após clonar o repositório

set -e

echo "📋 Configurando Git Hooks..."
echo ""

# Detectar Sistema Operacional
OS=$(uname -s)

# Diretório de hooks
HOOKS_DIR=".git/hooks"
GITHOOKS_DIR=".githooks"

# Criar hooks se não existirem
if [ ! -d "$GITHOOKS_DIR" ]; then
  mkdir -p "$GITHOOKS_DIR"
  echo "✓ Diretório .githooks criado"
fi

# Tornar scripts executáveis
chmod +x "$GITHOOKS_DIR"/* 2>/dev/null || true

# Configurar Git para usar diretório personalizado de hooks
git config core.hooksPath "$GITHOOKS_DIR"
echo "✓ Git configurado para usar hooks em .githooks"

# Verificar se hooks estão no lugar
echo ""
echo "📌 Hooks instalados:"
for hook in commit-msg pre-commit pre-push; do
  if [ -f "$GITHOOKS_DIR/$hook" ]; then
    echo "  ✓ $hook"
  else
    echo "  ✗ $hook (não encontrado)"
  fi
done

echo ""
echo "🎉 Git Hooks configurados com sucesso!"
echo ""
echo "Próximo passo:"
echo "  npm install    # Se não tiver feito ainda"
echo "  npm run dev    # Começar a desenvolver"
echo ""
echo "Nota: Os hooks rodarão automaticamente em:"
echo "  - pre-commit: antes de fazer 'git commit'"
echo "  - commit-msg: validação de mensagem"
echo "  - pre-push: antes de fazer 'git push'"
