# Orquestrador de Ambiente de Desenvolvimento Local

Este repositório é um **orquestrador unificado de ambiente de desenvolvimento local**. Ele **não contém código de aplicação**, e sim clona seus projetos independentes de repositórios Git externos, monta-os sob uma única rede Docker integrada, e os roteia dinamicamente utilizando nomes de domínio locais (como `blog.local`) com o `nginx-proxy`.

A arquitetura do ambiente baseia-se na unificação do Docker Compose usando a variável nativa `COMPOSE_FILE` do Docker, gerada de maneira declarativa a partir de um **único manifesto de configuração** (`projects.yml`).

---

## 🎨 Funcionalidades do Painel Web (AI Studio)

Para tornar o gerenciamento do seu orquestrador ainda mais visual e simples, implementamos um **Painel de Controle Gráfico** que roda diretamente no seu navegador. Com ele você pode:
1. **Visualizar seus Projetos**: Veja todos os serviços registrados, suas respectivas portas virtuais, grupos, URLs do Git e domínios locais.
2. **Scaffold Gráfico (Criador de Serviços)**: Um assistente visual completo para cadastrar novos projetos. Ele insere automaticamente a entrada no `projects.yml` e gera o arquivo `compose/docker-compose-<nome>.yml` apropriado para a stack selecionada (Node.js ou PHP).
3. **Explorador de Arquivos**: Analise de imediato o conteúdo dos arquivos gerados pelo orquestrador, como o `.env` gerado, as receitas do `docker-compose.yml`, os scripts de bash utilitários e o manifesto único.
4. **Console de Logs**: Execute comandos do orquestrador com um clique e visualize as saídas do instalador e as checagens de integridade diretamente no terminal embutido.

---

## 📐 Princípios de Arquitetura

1. **Aplicações Fora do Repositório (`/mnt`)**: Todo o código das suas aplicações vive dentro do diretório `/mnt/` (ex: `mnt/pessoal/blog/`). Esse diretório inteiro está listado no `.gitignore` e nunca será versionado ou comitado neste repositório. Cada pasta em `mnt/` é um repositório Git independente.
2. **Manifesto Único (`projects.yml`)**: A única fonte de verdade de quais projetos existem no seu ambiente local. Adicionar ou remover serviços resume-se a editar este arquivo ou utilizar o CLI interactivo.
3. **Mesclagem Dinâmica de Composes**: O `docker-compose.yml` base define a infraestrutura comum (proxy, bancos globais). Cada projeto tem seu compose individual na pasta `compose/`. O instalador compila no `.env` a variável `COMPOSE_FILE` listando todos os composes do diretório separados por `:` (ex: `docker-compose.yml:compose/docker-compose-blog.yml:...`).
4. **Hosts Locais Automatizados**: Os hostnames declarados são gravados de forma idempotente e segura dentro do arquivo `/etc/hosts` do sistema operacional do host pessoal através de marcas de comentários sentinelas, evitando duplicações.
5. **Comando de Escuta Geral (`--host` em Node)**: Os servidores dev Node (Vite, Vue CLI, React) são instruídos a rodar com o parâmetro `--host` para escutarem em `0.0.0.0` no container, permitindo que o `nginx-proxy` central os localize perfeitamente e evite o erro de gateway `502`.

---

## 📁 Estrutura de Diretórios Criada

```
.
├── install                       # Script de entrada: roda os passos ordenados
├── stop                          # Desliga todos os serviços do docker compose
├── README.md                     # Documentação oficial
├── .gitignore                    # Ignora pastas de execução (/mnt, /.env, node_modules)
├── .env.dist                     # Template limpo de variáveis globais de desenvolvimento
├── docker-compose.yml            # Infraestrutura base: nginx-proxy + bancos centrais
├── projects.yml                  # MANIFESTO ÚNICO (única fonte de verdade)
├── compose/                      # Composes individuais de cada projeto
│   ├── docker-compose-planning-voter.yml
│   ├── docker-compose-blog.yml
│   └── docker-compose-site.yml
├── scripts/
│   ├── lib.sh                    # Biblioteca com logs coloridos e parser simples YAML
│   ├── 10-check-deps.sh          # Validador de Docker, Compose, Git e portas livres
│   ├── 20-clone.sh               # Clona/atualiza os repositórios em mnt/ de forma segura
│   ├── 30-envs.sh                # Copia .env.example para .env em cada subprojeto
│   ├── 40-hosts.sh               # Atualiza o seu /etc/hosts local com backup prévio
│   ├── 50-gen-env.sh             # Compila o .env unificado e varre a pasta compose/
│   └── uteis/                    # Ferramentas adicionadas dinamicamente ao seu PATH
│       ├── dev-ls                # Lista serviços ativos e comentários explicativos
│       ├── dev-up                # Atalho para levantar serviços (docker compose up -d)
│       ├── dev-logs              # Atalho para logs (docker compose logs -f)
│       └── dev-reset-db          # Destrói e recria um container de banco do zero
└── new-service                   # CLI interativo para cadastrar e gerar novas stacks
```

---

## ⚡ Como Executar Pela Primeira Vez

### 1. Clonagem e Instalação Geral
Em sua máquina de desenvolvimento local física, basta clonar este repositório e executar o script de instalação rápida:

```bash
chmod +x install stop new-service scripts/*.sh scripts/uteis/*
./install
```

O instalador irá:
1. Validar se seu Docker, Git e portas estão prontos.
2. Clonar ou atualizar os repositórios reais listados em `projects.yml` (para testar sem clonar nada do Git, você pode rodar `./install --no-clone`).
3. Criar e preencher os arquivos `.env` internos de cada aplicação de forma segura.
4. Solicitar sua senha administrativa (`sudo`) para configurar o `/etc/hosts` com seus domínios locais.
5. Adicionar a pasta `scripts/uteis/` ao seu `PATH` no arquivo `.bashrc` ou `.zshrc` de forma a habilitar os utilitários de conveniência em qualquer terminal.

### 2. Subindo os Containers
Com a instalação concluída, você pode levantar todos os containers do ambiente de uma única vez com o comando:

```bash
dev-up
# Ou diretamente: docker compose up -d
```

---

## 🛠️ Comandos de Conveniência Úteis

Ao abrir seu terminal, você terá acesso aos seguintes comandos rápidos do orquestrador:

*   `dev-ls` — Lista detalhadamente todos os serviços cadastrados, o que cada um faz (lido a partir dos blocos `#####COMMENT`), os domínios virtuais atribuídos e os caminhos de compose.
*   `dev-up [servicos]` — Inicializa todos os serviços ou um grupo específico em segundo plano.
*   `dev-logs [servicos]` — Acompanha a saída de logs dos containers em tempo real.
*   `dev-reset-db <nome-do-banco-db>` — Apaga o container e o volume específico de um banco de dados e o recria zerado instantaneamente.
*   `./stop` — Para todos os serviços do orquestrador com segurança.

---

## 🧱 Como Adicionar um Novo Projeto ao Ambiente

Para incluir novos projetos ao ambiente, você pode escolher dois caminhos fáceis:

### Método A: Usando o CLI de Scaffold interativo
Execute o utilitário na raiz:
```bash
./new-service
```
Ele fará perguntas rápidas no terminal (Nome, Repositório Git, Stack (Node ou PHP), Versão, Banco Dedicado, Hostname Virtual, etc.) e fará todo o trabalho pesado por você.

### Método B: Editando manualmente
1. Abra o arquivo `projects.yml`.
2. Adicione a estrutura do seu projeto no formato padrão.
3. Crie um arquivo de compose correspondente na pasta `compose/docker-compose-<nome-do-seu-servico>.yml`.
4. Rode `./install --no-clone` para compilar o arquivo `.env` com o novo compose integrado.
