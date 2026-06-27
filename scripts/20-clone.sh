#!/usr/bin/env bash
# scripts/20-clone.sh — Clona ou atualiza os projetos declarados

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SOURCE_DIR}/lib.sh"

log_info "Verificando clonagem/atualização de repositórios..."

# Inicializa variáveis de controle
WITH_PROJECTS=""
NO_CLONE=0
FORCE_RESET=0

# Processa argumentos
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --with) WITH_PROJECTS="$2"; shift ;;
        --no-clone) NO_CLONE=1 ;;
        --force-reset) FORCE_RESET=1 ;;
    esac
    shift
done

if [ "$NO_CLONE" -eq 1 ]; then
    log_warn "Etapa de clonagem ignorada devido à flag --no-clone."
    exit 0
fi

# Garante que a pasta mnt existe
mkdir -p mnt
chmod 755 mnt

# Lê projetos do manifesto
PROJECTS_RAW=$(parse_projects_yml)

for row in $PROJECTS_RAW; do
    # Divide a linha pelos pipes
    IFS='|' read -r name group repo stack host port with_db db_engine default php_version node_version env_example <<< "$row"
    
    if [ -z "$name" ]; then
        continue
    fi
    
    # Verifica se deve clonar baseado no default ou na flag --with
    SHOULD_PROCESS=0
    if [ "$default" = "true" ]; then
        SHOULD_PROCESS=1
    elif [[ "$WITH_PROJECTS" =~ (^|,)"$name"(,|$) ]]; then
        SHOULD_PROCESS=1
    fi
    
    if [ "$SHOULD_PROCESS" -eq 0 ]; then
        log_info "Pulando projeto não-padrão: ${name} (use --with ${name} para incluir)"
        continue
    fi
    
    TARGET_DIR="mnt/${group}/${name}"
    
    if [ -d "${TARGET_DIR}/.git" ]; then
        log_info "Projeto ${name} já existe em ${TARGET_DIR}. Atualizando com fetch..."
        if [ "$FORCE_RESET" -eq 1 ]; then
            log_warn "Forçando reset completo (--force-reset). Alterações não commitadas serão perdidas!"
            (cd "$TARGET_DIR" && git fetch origin && git reset --hard origin/$(git symbolic-ref --short HEAD))
        else
            (cd "$TARGET_DIR" && git fetch origin)
            log_success "Projeto ${name} sincronizado via fetch (sem sobrescrever alterações locais)."
        fi
    else
        log_info "Clonando ${name} de ${repo} para ${TARGET_DIR}..."
        mkdir -p "mnt/${group}"
        if git clone "$repo" "$TARGET_DIR"; then
            log_success "Projeto ${name} clonado com sucesso!"
        else
            log_warn "Falha ao clonar ${name}. Verifique suas chaves SSH ou se o repositório existe."
            # Cria pasta fake/vazia para o ambiente não quebrar se o usuário estiver apenas testando
            mkdir -p "$TARGET_DIR"
            echo "# Clone Mock do projeto ${name}" > "${TARGET_DIR}/README.md"
        fi
    fi
done

log_success "Sincronização de repositórios finalizada!"
