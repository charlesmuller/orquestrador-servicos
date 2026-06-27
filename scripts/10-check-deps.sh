#!/usr/bin/env bash
# scripts/10-check-deps.sh — Verifica as dependências locais

# Carrega a biblioteca de utilitários
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SOURCE_DIR}/lib.sh"

log_info "Iniciando verificação de dependências..."

FAILED=0

# 1. Verifica Git
if command -v git >/dev/null 2>&1; then
    log_success "Git está instalado ($(git --version))"
else
    log_error "Git não está instalado. Por favor, instale o Git para continuar."
    FAILED=1
fi

# 2. Verifica Docker
if command -v docker >/dev/null 2>&1; then
    log_success "Docker está instalado ($(docker --version))"
    # Verifica se o daemon do docker está rodando
    if docker info >/dev/null 2>&1; then
        log_success "Docker daemon está ativo e rodando."
    else
        log_warn "O Docker daemon não parece estar rodando. Certifique-se de iniciar o Docker Desktop ou serviço."
    fi
else
    log_error "Docker não está instalado. Por favor, instale o Docker para continuar."
    FAILED=1
fi

# 3. Verifica Docker Compose v2 (plugin ou comando)
if docker compose version >/dev/null 2>&1; then
    log_success "Docker Compose v2 está instalado ($(docker compose version))"
else
    log_error "Docker Compose v2 (plugin 'docker compose') não encontrado. Requerido v2+."
    FAILED=1
fi

# 4. Verifica yq (opcional, mas recomendado)
if command -v yq >/dev/null 2>&1; then
    log_success "yq está instalado ($(yq --version))"
else
    log_warn "yq não está instalado. O instalador usará o parser simples integrado em Bash."
fi

# 5. Verifica se as portas 80 e 443 estão ocupadas
check_port() {
    local port=$1
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost "$port" >/dev/null 2>&1; then
            log_warn "A porta ${port} parece estar em uso por outro serviço local. Isso pode conflitar com o nginx-proxy."
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -i:"$port" >/dev/null 2>&1; then
            log_warn "A porta ${port} parece estar em uso por outro serviço local. Isso pode conflitar com o nginx-proxy."
        fi
    fi
}

check_port 80
check_port 443

if [ "$FAILED" -eq 1 ]; then
    log_error "Algumas dependências obrigatórias estão ausentes. Corrija-as e execute novamente."
    exit 1
else
    log_success "Todas as dependências críticas verificadas com sucesso!"
fi
