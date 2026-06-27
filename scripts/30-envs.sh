#!/usr/bin/env bash
# scripts/30-envs.sh — Configura arquivos .env individuais de cada projeto

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SOURCE_DIR}/lib.sh"

log_info "Configurando arquivos .env dos serviços..."

FORCE_ENVS=0
WITH_PROJECTS=""

# Processa argumentos
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --force-envs) FORCE_ENVS=1 ;;
        --with) WITH_PROJECTS="$2"; shift ;;
    esac
    shift
done

PROJECTS_RAW=$(parse_projects_yml)

for row in $PROJECTS_RAW; do
    IFS='|' read -r name group repo stack host port with_db db_engine default php_version node_version env_example <<< "$row"
    
    if [ -z "$name" ]; then
        continue
    fi
    
    # Verifica se deve processar baseado no default ou na flag --with
    SHOULD_PROCESS=0
    if [ "$default" = "true" ]; then
        SHOULD_PROCESS=1
    elif [[ "$WITH_PROJECTS" =~ (^|,)"$name"(,|$) ]]; then
        SHOULD_PROCESS=1
    fi
    
    if [ "$SHOULD_PROCESS" -eq 0 ]; then
        continue
    fi
    
    # Determina caminhos do .env.example e .env
    PROJECT_BASE="mnt/${group}/${name}"
    
    # Se a pasta do projeto não existe de verdade, avisa e pula
    if [ ! -d "$PROJECT_BASE" ]; then
        log_warn "Diretório ${PROJECT_BASE} não existe. Pulei configuração do .env."
        continue
    fi
    
    EXAMPLE_REL="$env_example"
    # Se não foi especificado, adota o padrão da raiz
    if [ -z "$EXAMPLE_REL" ]; then
        EXAMPLE_REL=".env.example"
    fi
    
    EXAMPLE_PATH="${PROJECT_BASE}/${EXAMPLE_REL}"
    # O arquivo .env fica no mesmo diretório do .env.example correspondente
    ENV_DIR=$(dirname "$EXAMPLE_PATH")
    ENV_PATH="${ENV_DIR}/.env"
    
    if [ -f "$EXAMPLE_PATH" ]; then
        if [ -f "$ENV_PATH" ] && [ "$FORCE_ENVS" -eq 0 ]; then
            log_info "O arquivo ${ENV_PATH} já existe. Pulando (use --force-envs para sobrescrever)."
        else
            cp "$EXAMPLE_PATH" "$ENV_PATH"
            log_success "Criado .env para ${name} a partir de $(basename "$EXAMPLE_PATH")"
        fi
    else
        # Se não há .env.example, mas também não há .env, criamos um vazio por segurança para o Compose não dar erro
        if [ ! -f "$ENV_PATH" ]; then
            touch "$ENV_PATH"
            log_info "Nenhum arquivo de exemplo encontrado para ${name}. Criado .env vazio."
        fi
    fi
done

log_success "Configuração de variáveis de ambiente dos projetos finalizada!"
