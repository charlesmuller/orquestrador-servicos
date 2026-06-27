#!/usr/bin/env bash
# scripts/50-gen-env.sh — Gera o arquivo .env unificado do orquestrador local

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SOURCE_DIR}/lib.sh"

log_info "Gerando arquivo .env unificado do orquestrador..."

# Copia .env.dist se .env não existir
if [ ! -f .env ]; then
    cp .env.dist .env
    log_info "Criado .env inicial a partir de .env.dist"
fi

# Detecta usuário e grupo atual para compatibilidade de permissão no Docker
USER_ID=$(id -u 2>/dev/null || echo "1000")
PROJECT_PATH=$(pwd)

set_env_var ".env" "ID_USER" "$USER_ID"
set_env_var ".env" "PWD_PROJETO" "$PROJECT_PATH"

# Varre a pasta compose/ para listar todos os arquivos docker-compose-*.yml
COMPOSE_FILES="docker-compose.yml"

if [ -d "compose" ]; then
    # Ordena para manter a ordem consistente
    for comp in $(ls compose/docker-compose-*.yml 2>/dev/null | sort); do
        COMPOSE_FILES="${COMPOSE_FILES}:${comp}"
    done
fi

set_env_var ".env" "COMPOSE_FILE" "$COMPOSE_FILES"
set_env_var ".env" "COMPOSE_PATH_SEPARATOR" ":"

log_success "Arquivo .env unificado atualizado com sucesso!"
log_info "COMPOSE_FILE=${COMPOSE_FILES}"
