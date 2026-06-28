import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { parse, stringify } from "yaml";

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Retorna todos os projetos cadastrados
app.get("/api/projects", (req, res) => {
  try {
    const filePath = path.join(process.cwd(), "projects.yml");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo projects.yml não encontrado." });
    }
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const parsed = parse(fileContent);
    res.json((parsed && parsed.projects) || []);
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao ler projetos: " + error.message });
  }
});

// API: Adiciona um novo projeto e gera seu arquivo compose
app.post("/api/projects", (req, res) => {
  try {
    const {
      name,
      repo,
      group,
      stack,
      php_version,
      node_version,
      framework,
      host,
      port,
      with_db,
      db_engine,
      description,
      env_example,
      subdir,
    } = req.body;

    if (!name || !repo) {
      return res.status(400).json({ error: "Nome do projeto e URL do repositório são obrigatórios." });
    }

    const filePath = path.join(process.cwd(), "projects.yml");
    let projectsList: any[] = [];
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsed = parse(fileContent);
      projectsList = (parsed && parsed.projects) || [];
    }

    // Verifica duplicidade
    if (projectsList.some((p: any) => p.name === name)) {
      return res.status(400).json({ error: `Um projeto com o nome '${name}' já existe.` });
    }

    // Constrói o novo objeto de projeto
    const newProject: any = {
      name,
      repo,
      group: group || "pessoal",
      stack,
    };

    if (stack === "php") {
      newProject.php_version = php_version || "8.2";
      newProject.host = host || `${name}.local`;
      newProject.with_db = with_db === true || with_db === "true";
      if (newProject.with_db) {
        newProject.db_engine = db_engine || "mysql";
      }
    } else {
      newProject.framework = framework || "vite";
      newProject.node_version = node_version || "20";
      newProject.host = host || `${name}.local`;
      newProject.port = port ? parseInt(port, 10) : 8003;
      if (subdir) {
        newProject.subdir = subdir;
      }
    }

    if (env_example) {
      newProject.env_example = env_example;
    }

    newProject.default = true;

    // Atualiza o arquivo projects.yml
    projectsList.push(newProject);
    fs.writeFileSync(filePath, stringify({ projects: projectsList }), "utf-8");

    // Gera o arquivo compose correspondente
    const composeDir = path.join(process.cwd(), "compose");
    if (!fs.existsSync(composeDir)) {
      fs.mkdirSync(composeDir, { recursive: true });
    }

    const composePath = path.join(composeDir, `docker-compose-${name}.yml`);
    let composeContent = "";

    const desc = description || `Serviço ${name} rodando na stack ${stack}`;

    if (stack === "php") {
      const phpVerClean = (php_version || "8.2").replace(".", "");
      composeContent = `services:
  #####COMMENT: ${desc} #####ENDCOMMENT
  ${name}:
    container_name: ${name}
    image: \${PHP_${phpVerClean}_IMAGE:-webdevops/php-nginx:${php_version || "8.2"}}
    environment:
      - VIRTUAL_HOST=${host || `${name}.local`}
      - VIRTUAL_PORT=80
      - APP_ENV=local
      - WEB_DOCUMENT_ROOT=/app/public
      - TZ=America/Sao_Paulo
    volumes:
      - ./mnt/${group || "pessoal"}/${name}:/app
    env_file:
      - ./mnt/${group || "pessoal"}/${name}/.env
    networks:
      - dev-network
    depends_on:
      - nginx-proxy`;

      if (newProject.with_db) {
        if (db_engine === "postgres") {
          composeContent += `
      - ${name}-db

  ${name}-db:
    container_name: ${name}-db
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: ${name}
    volumes:
      - ${name}-db-data:/var/lib/postgresql/data
    networks:
      - dev-network

volumes:
  ${name}-db-data:`;
        } else {
          composeContent += `
      - ${name}-db

  ${name}-db:
    container_name: ${name}-db
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: devpassword
      MYSQL_DATABASE: ${name}
    volumes:
      - ${name}-db-data:/var/lib/mysql
    networks:
      - dev-network

volumes:
  ${name}-db-data:`;
        }
      }

      composeContent += `

networks:
  dev-network:
    name: dev-network
`;
    } else {
      const subdirPath = subdir ? `/${subdir}` : "";
      const cmd = framework === "vue-cli" 
        ? `yarn install && yarn serve --port ${port || 8003}` 
        : `yarn install && yarn dev --host --port ${port || 8003}`;
      
      const hostEnv = framework === "vue-cli" ? "\n      - HOST=0.0.0.0" : "";

      composeContent = `services:
  #####COMMENT: ${desc} #####ENDCOMMENT
  ${name}:
    container_name: ${name}
    image: node:${node_version || "20"}
    working_dir: /app${subdirPath}
    command: bash -c "${cmd}"
    depends_on:
      - nginx-proxy
    volumes:
      - ./mnt/${group || "pessoal"}/${name}:/app
      - /app${subdirPath}/node_modules
    environment:
      - VIRTUAL_HOST=${host || `${name}.local`}
      - VIRTUAL_PORT=${port || 8003}${hostEnv}
    env_file:
      - ./mnt/${group || "pessoal"}/${name}/.env
    networks:
      - dev-network

networks:
  dev-network:
    name: dev-network
`;
    }

    fs.writeFileSync(composePath, composeContent, "utf-8");

    res.json({ success: true, project: newProject });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao adicionar projeto: " + error.message });
  }
});

// API: Deleta um projeto e seu compose
app.delete("/api/projects/:name", (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(process.cwd(), "projects.yml");
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Manifesto projects.yml não encontrado." });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const parsed = parse(fileContent);
    const projectsList = (parsed && parsed.projects) || [];

    const index = projectsList.findIndex((p: any) => p.name === name);
    if (index === -1) {
      return res.status(404).json({ error: `Projeto '${name}' não encontrado.` });
    }

    projectsList.splice(index, 1);
    fs.writeFileSync(filePath, stringify({ projects: projectsList }), "utf-8");

    // Deleta o arquivo de compose correspondente
    const composePath = path.join(process.cwd(), "compose", `docker-compose-${name}.yml`);
    if (fs.existsSync(composePath)) {
      fs.unlinkSync(composePath);
    }

    res.json({ success: true, message: `Projeto '${name}' removido com sucesso.` });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao remover projeto: " + error.message });
  }
});

// API: Retorna arquivos chaves do orquestrador para exibição
app.get("/api/files", (req, res) => {
  try {
    const filesList = [
      { name: "projects.yml", path: "projects.yml", type: "yaml" },
      { name: "docker-compose.yml", path: "docker-compose.yml", type: "yaml" },
      { name: ".env.dist", path: ".env.dist", type: "env" },
      { name: ".env (Gerado)", path: ".env", type: "env" },
      { name: "install (Script)", path: "install", type: "bash" },
      { name: "stop (Script)", path: "stop", type: "bash" },
      { name: "new-service (Script)", path: "new-service", type: "bash" },
      { name: "scripts/lib.sh", path: "scripts/lib.sh", type: "bash" },
    ];

    const result = filesList.map((f) => {
      const fullPath = path.join(process.cwd(), f.path);
      let content = "Arquivo não existente no momento. Execute a instalação para gerá-lo.";
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, "utf-8");
      }
      return {
        ...f,
        content,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao ler arquivos: " + error.message });
  }
});

// API: Executa scripts e retorna a saída real
app.post("/api/run-script", (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Comando não especificado." });
  }

  // Sanitiza comandos para evitar injeção insegura
  const allowedCommands = [
    "bash ./install --no-clone",
    "bash ./install --no-clone --force-envs",
    "bash ./stop",
    "bash ./scripts/10-check-deps.sh",
    "bash ./scripts/50-gen-env.sh",
    "bash ./scripts/uteis/dev-ls"
  ];

  if (!allowedCommands.includes(command)) {
    return res.status(400).json({ error: "Comando não autorizado para execução na sandbox." });
  }

  // Torna executável se necessário
  try {
    exec("chmod +x install stop scripts/*.sh scripts/uteis/*", () => {});
  } catch (e) {}

  exec(command, (error, stdout, stderr) => {
    res.json({
      stdout: stdout || "",
      stderr: stderr || "",
      code: error ? error.code : 0,
    });
  });
});

async function startServer() {
  // Configura Vite middleware para desenvolvimento, senão serve arquivos estáticos na build
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
