#!/usr/bin/env bash
# scripts/40-hosts.sh — Adiciona os domínios .local ao /etc/hosts local de forma limpa

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SOURCE_DIR}/lib.sh"

log_info "Atualizando domínios no arquivo /etc/hosts..."

# Coleta todos os domínios únicos configurados no projects.yml
DOMAINS=""
PROJECTS_RAW=$(parse_projects_yml)

for row in $PROJECTS_RAW; do
    IFS='|' read -r name group repo stack host port with_db db_engine default php_version node_version env_example <<< "$row"
    if [ -n "$host" ]; then
        DOMAINS="${DOMAINS} ${host}"
    fi
done

# Sempre inclui domínios compartilhados importantes
DOMAINS="${DOMAINS} phpmyadmin.local"

# Remove espaços duplicados e limpa
DOMAINS=$(echo "$DOMAINS" | xargs)

if [ -z "$DOMAINS" ]; then
    log_warn "Nenhum domínio local encontrado no manifesto projects.yml."
    exit 0
fi

log_info "Domínios mapeados: ${DOMAINS}"

SENTINEL="# dev-orquestrador"
TEMP_HOSTS=$(mktemp)

# Se puder ler o /etc/hosts do container
if [ -f /etc/hosts ]; then
    # Faz backup do /etc/hosts original
    BACKUP_PATH="/tmp/hosts.bak-$(date +%Y%m%d%H%M%S)"
    cp /etc/hosts "$BACKUP_PATH"
    log_info "Backup do seu /etc/hosts criado em: ${BACKUP_PATH}"

    # Remove qualquer bloco anterior marcado com o sentinela
    grep -v "${SENTINEL}" /etc/hosts > "$TEMP_HOSTS"
    
    # Prepara a nova linha que será adicionada
    NEW_ENTRY="127.0.0.1 ${DOMAINS} ${SENTINEL}"
    echo "$NEW_ENTRY" >> "$TEMP_HOSTS"

    # Tenta salvar no /etc/hosts. No container Cloud Run pode falhar por falta de permissão de root,
    # então tratamos com elegância, avisando ao usuário o comando que ele deve rodar em seu computador pessoal.
    if command -v sudo >/dev/null 2>&1 && sudo cp "$TEMP_HOSTS" /etc/hosts >/dev/null 2>&1; then
        log_success "Arquivo /etc/hosts atualizado com sucesso no seu sistema!"
    else
        log_warn "Não foi possível gravar diretamente no /etc/hosts (esperado no sandbox sem permissão sudo)."
        log_warn "Para subir localmente em sua máquina, você deve adicionar a seguinte linha ao seu /etc/hosts pessoal:"
        echo -e "${YELLOW}127.0.0.1 ${DOMAINS}${NC}"
    fi
else
    log_warn "Arquivo /etc/hosts não encontrado para edição."
fi

rm -f "$TEMP_HOSTS"
