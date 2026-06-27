#!/usr/bin/env bash

# Cores do terminal
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[0;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0;m' # No Color

# Funções de logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Define ou atualiza uma variável em um arquivo .env de maneira idempotente
set_env_var() {
    local file="$1"
    local var="$2"
    local value="$3"

    if [ ! -f "$file" ]; then
        touch "$file"
    fi

    if grep -q "^${var}=" "$file"; then
        # Substitui a linha existente de forma compatível com macOS e Linux
        sed -i.bak "s|^${var}=.*|${var}=${value}|" "$file" && rm -f "${file}.bak"
    else
        # Adiciona no final
        echo "${var}=${value}" >> "$file"
    fi
}

# Função simples para extrair projetos do YAML sem depender obrigatoriamente do yq
# Retorna uma lista de strings no formato: "name|group|repo|stack|host|port|with_db|db_engine|default"
parse_projects_yml() {
    local file="projects.yml"
    if [ ! -f "$file" ]; then
        log_error "Arquivo $file não encontrado!"
        return 1
    fi

    # Se yq estiver disponível, usa yq que é 100% robusto
    if command -v yq >/dev/null 2>&1; then
        yq eval '.projects[] | [ .name, .group, .repo, .stack, .host, (.port // ""), (.with_db // "false"), (.db_engine // ""), (.default // "true"), (.php_version // ""), (.node_version // ""), (.env_example // "") ] | join("|")' "$file"
    else
        # Parser simples em bash se o usuário não tiver yq instalado localmente
        # Esta é uma alternativa segura para ambientes mínimos
        local name="" group="" repo="" stack="" host="" port="" with_db="false" db_engine="" default="true" php_version="" node_version="" env_example=""
        
        while IFS= read -r line || [ -n "$line" ]; do
            # Limpa espaços e carriage returns
            line=$(echo "$line" | sed 's/\r//g' | xargs)
            
            # Pula comentários ou linhas vazias
            [[ "$line" =~ ^# ]] && continue
            [[ -z "$line" ]] && continue
            
            if [[ "$line" =~ ^-\ name:\ (.*) ]] || [[ "$line" =~ ^name:\ (.*) ]]; then
                # Se já temos um projeto acumulado, imprime
                if [ -n "$name" ]; then
                    echo "${name}|${group}|${repo}|${stack}|${host}|${port}|${with_db}|${db_engine}|${default}|${php_version}|${node_version}|${env_example}"
                fi
                # Reinicia variáveis para o novo projeto
                name="${BASH_REMATCH[1]}"
                group="" repo="" stack="" host="" port="" with_db="false" db_engine="" default="true" php_version="" node_version="" env_example=""
            elif [[ "$line" =~ ^group:\ (.*) ]]; then
                group="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^repo:\ (.*) ]]; then
                repo="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^stack:\ (.*) ]]; then
                stack="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^host:\ (.*) ]]; then
                host="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^port:\ ([0-9]+) ]]; then
                port="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^with_db:\ (.*) ]]; then
                with_db="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^db_engine:\ (.*) ]]; then
                db_engine="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^default:\ (.*) ]]; then
                default="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^php_version:\ (.*) ]]; then
                php_version="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^node_version:\ (.*) ]]; then
                node_version="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^env_example:\ (.*) ]]; then
                env_example="${BASH_REMATCH[1]}"
            fi
        done < "$file"
        
        # Imprime o último projeto processado
        if [ -n "$name" ]; then
            echo "${name}|${group}|${repo}|${stack}|${host}|${port}|${with_db}|${db_engine}|${default}|${php_version}|${node_version}|${env_example}"
        fi
    fi
}
