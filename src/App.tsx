import React, { useState, useEffect } from "react";
import { 
  Layers, 
  Terminal as TerminalIcon, 
  PlusCircle, 
  Folder, 
  FileText, 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Code, 
  Cpu, 
  Database, 
  Activity,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Project {
  name: string;
  repo: string;
  group: string;
  stack: "php" | "node";
  php_version?: string;
  node_version?: string;
  framework?: string;
  host: string;
  port?: number;
  with_db?: boolean;
  db_engine?: string;
  default?: boolean;
}

interface OrchestratorFile {
  name: string;
  path: string;
  type: string;
  content: string;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<OrchestratorFile[]>([]);
  const [activeTab, setActiveTab] = useState<"projects" | "scaffold" | "files" | "terminal">("projects");
  const [selectedFile, setSelectedFile] = useState<string>("projects.yml");
  const [terminalLogs, setTerminalLogs] = useState<{ type: "stdout" | "stderr" | "info" | "success" | "error"; text: string }[]>([]);
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Form de Scaffold
  const [formData, setFormData] = useState({
    name: "",
    repo: "",
    group: "pessoal",
    stack: "node" as "node" | "php",
    php_version: "8.2",
    node_version: "20",
    framework: "vite",
    host: "",
    port: "8003",
    with_db: false,
    db_engine: "mysql",
    description: "",
    env_example: ""
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  // Busca projetos e arquivos
  const fetchData = async () => {
    try {
      const pRes = await fetch("/api/projects");
      const pData = await pRes.json();
      if (Array.isArray(pData)) {
        setProjects(pData);
      }

      const fRes = await fetch("/api/files");
      const fData = await fRes.json();
      if (Array.isArray(fData)) {
        setFiles(fData);
      }
    } catch (e) {
      console.error("Erro ao buscar dados do servidor:", e);
    }
  };

  useEffect(() => {
    fetchData();
    // Mensagem de boas-vindas no terminal
    setTerminalLogs([
      { type: "info", text: "--- Orquestrador de Ambiente Local Inicializado ---" },
      { type: "info", text: "Clique nos botões de script abaixo para rodar ou gerenciar os comandos reais." },
    ]);
  }, []);

  // Copia o conteúdo do arquivo
  const handleCopy = (content: string, fileName: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // Exclui um projeto do orquestrador
  const handleDeleteProject = async (name: string) => {
    if (!confirm(`Deseja remover o projeto '${name}' e seu arquivo de docker-compose associado?`)) return;

    try {
      const res = await fetch(`/api/projects/${name}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTerminalLogs((prev) => [
          ...prev,
          { type: "success", text: `Projeto '${name}' removido com sucesso.` }
        ]);
        fetchData();
      } else {
        alert(data.error || "Erro ao deletar projeto.");
      }
    } catch (e: any) {
      alert("Erro ao excluir projeto: " + e.message);
    }
  };

  // Envia formulário de Scaffold
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess(false);

    if (!formData.name.trim()) return setFormError("O nome do serviço é obrigatório.");
    if (!formData.repo.trim()) return setFormError("A URL do repositório Git é obrigatória.");

    // Sanitiza nome
    const cleanName = formData.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");

    const hostName = formData.host.trim() || `${cleanName}.local`;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name: cleanName,
          host: hostName,
        })
      });

      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else {
        setFormSuccess(true);
        setTerminalLogs((prev) => [
          ...prev,
          { type: "success", text: `Novo serviço criado: ${cleanName} (${hostName})` },
          { type: "info", text: `Arquivo de compose criado: compose/docker-compose-${cleanName}.yml` },
        ]);
        // Limpa formulário
        setFormData({
          name: "",
          repo: "",
          group: "pessoal",
          stack: "node",
          php_version: "8.2",
          node_version: "20",
          framework: "vite",
          host: "",
          port: "8003",
          with_db: false,
          db_engine: "mysql",
          description: "",
          env_example: ""
        });
        fetchData();
        setTimeout(() => setFormSuccess(false), 5000);
      }
    } catch (err: any) {
      setFormError("Erro de comunicação com o servidor: " + err.message);
    }
  };

  // Roda um script do orquestrador
  const runScript = async (command: string, desc: string) => {
    if (isRunningScript) return;
    setIsRunningScript(true);
    setActiveTab("terminal");
    setTerminalLogs((prev) => [
      ...prev,
      { type: "info", text: `> Executando: ${command} (${desc})` }
    ]);

    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await res.json();

      if (data.error) {
        setTerminalLogs((prev) => [
          ...prev,
          { type: "error", text: `Erro: ${data.error}` }
        ]);
      } else {
        if (data.stdout) {
          // Processa quebras de linha
          const lines = data.stdout.split("\n");
          lines.forEach((line: string) => {
            if (line.trim()) {
              if (line.includes("[OK]")) {
                setTerminalLogs((prev) => [...prev, { type: "success", text: line }]);
              } else if (line.includes("[WARN]")) {
                setTerminalLogs((prev) => [...prev, { type: "error", text: line }]); // Usa estilo visível
              } else if (line.includes("[ERROR]")) {
                setTerminalLogs((prev) => [...prev, { type: "error", text: line }]);
              } else {
                setTerminalLogs((prev) => [...prev, { type: "stdout", text: line }]);
              }
            }
          });
        }
        if (data.stderr) {
          const errLines = data.stderr.split("\n");
          errLines.forEach((line: string) => {
            if (line.trim()) {
              setTerminalLogs((prev) => [...prev, { type: "stderr", text: line }]);
            }
          });
        }
        setTerminalLogs((prev) => [
          ...prev,
          { type: "success", text: `Comando concluído com código ${data.code}.` }
        ]);
      }
      fetchData(); // Atualiza arquivos após rodar scripts
    } catch (e: any) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "error", text: `Falha de conexão ao executar: ${e.message}` }
      ]);
    } finally {
      setIsRunningScript(false);
    }
  };

  const getFileContent = () => {
    const file = files.find((f) => f.name === selectedFile);
    return file ? file.content : "Selecione um arquivo.";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Orquestrador Local
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Docker Compose Unified Environment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-full px-3 py-1.5 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Ambiente Ativo</span>
          </div>
          <a 
            href="https://github.com/charlesmuller" 
            target="_blank" 
            referrerPolicy="no-referrer"
            className="text-slate-400 hover:text-slate-200 transition-colors p-2"
          >
            <Globe className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* CORE CONTROL BAR (SCRIPTS RÁPIDOS) */}
      <section className="bg-slate-900 border-b border-slate-800/80 px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <TerminalIcon className="w-4 h-4 text-emerald-500" />
          <span>Comandos Rápidos:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runScript("bash ./install --no-clone", "Instalar / Atualizar Ambiente")}
            disabled={isRunningScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            ./install (sem clone)
          </button>
          
          <button
            onClick={() => runScript("bash ./install --no-clone --force-envs", "Forçar Reset de .env dos Projetos")}
            disabled={isRunningScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 transition-all cursor-pointer border border-slate-700"
          >
            <RotateCw className="w-3.5 h-3.5" />
            --force-envs
          </button>

          <button
            onClick={() => runScript("bash ./stop", "Parar todos os containers")}
            disabled={isRunningScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-rose-950 hover:bg-rose-900 disabled:opacity-50 text-rose-200 border border-rose-800/50 transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            ./stop
          </button>

          <button
            onClick={() => runScript("bash ./scripts/uteis/dev-ls", "Listar Serviços do Compose")}
            disabled={isRunningScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 transition-all cursor-pointer border border-slate-700"
          >
            <Code className="w-3.5 h-3.5" />
            dev-ls
          </button>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-2 px-2">Navegação</p>
            
            <button
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "projects" 
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Projetos ({projects.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("scaffold")}
              className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "scaffold" 
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Serviço</span>
            </button>

            <button
              onClick={() => setActiveTab("files")}
              className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "files" 
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Explorador de Arquivos</span>
            </button>

            <button
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "terminal" 
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              <span>Log do Terminal</span>
            </button>
          </div>

          {/* ARQUITETURA RESUMO */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3 font-mono text-xs">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              Status da Arquitetura
            </h4>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500">PROXY REVERSO</span>
                <span className="text-slate-200 font-bold">Nginx-Proxy</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500">DOMÍNIOS</span>
                <span className="text-slate-200 font-bold">*.local</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500">BD CENTRAL</span>
                <span className="text-slate-200 font-bold">MySQL+Postgres</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500">DOCKER COMPOSE</span>
                <span className="text-slate-200 font-bold">Compose v2</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-2.5">
              Os códigos não vivem neste repositório. O diretório <code className="text-slate-300">mnt/</code> é preservado no <code className="text-slate-300">.gitignore</code>.
            </div>
          </div>
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            
            {/* PROJECTS VIEW */}
            {activeTab === "projects" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Seus Serviços Registrados</h2>
                    <p className="text-sm text-slate-400">Projetos declarados em projects.yml que sobem unificados no Compose.</p>
                  </div>
                  <button 
                    onClick={fetchData} 
                    className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-all cursor-pointer"
                    title="Recarregar projetos"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((proj) => (
                    <div 
                      key={proj.name}
                      className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none"></div>
                      
                      <div>
                        {/* Header do card */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                            proj.stack === "php" 
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {proj.stack === "php" ? `PHP ${proj.php_version || "8.2"}` : `Node ${proj.node_version || "20"}`}
                          </span>
                          
                          <button
                            onClick={() => handleDeleteProject(proj.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                            title="Remover projeto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Título e Grupo */}
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors font-mono">
                          {proj.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-mono">
                          <Folder className="w-3.5 h-3.5" />
                          <span>mnt/{proj.group}/{proj.name}</span>
                        </p>

                        <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-4 text-xs font-mono">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Host Virtual:</span>
                            <a 
                              href={`http://${proj.host}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              {proj.host}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {proj.stack === "node" && (
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Framework:</span>
                              <span className="text-slate-300 capitalize">{proj.framework || "vite"}</span>
                            </div>
                          )}

                          {proj.stack === "node" && proj.port && (
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Porta Interna:</span>
                              <span className="text-slate-300">{proj.port}</span>
                            </div>
                          )}

                          {proj.stack === "php" && (
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Banco Dedicado:</span>
                              <span className="text-slate-300 flex items-center gap-1">
                                {proj.with_db ? (
                                  <>
                                    <Database className="w-3 h-3 text-emerald-500" />
                                    Sim ({proj.db_engine || "mysql"})
                                  </>
                                ) : "Não"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>Padrão de Execução:</span>
                        <span className={proj.default !== false ? "text-emerald-400" : "text-amber-500"}>
                          {proj.default !== false ? "Sobe Automaticamente" : "Sob Demanda (--with)"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {projects.length === 0 && (
                    <div className="col-span-2 py-12 text-center bg-slate-900 border border-slate-800 border-dashed rounded-xl flex flex-col items-center justify-center gap-3">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                      <p className="text-sm text-slate-300">Nenhum projeto cadastrado no manifesto `projects.yml`.</p>
                      <button
                        onClick={() => setActiveTab("scaffold")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all cursor-pointer"
                      >
                        Cadastrar Primeiro Projeto
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SCAFFOLD / NEW-SERVICE VIEW */}
            {activeTab === "scaffold" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-6"
              >
                <div className="mb-6 border-b border-slate-800/80 pb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <PlusCircle className="text-emerald-500 w-5 h-5" />
                    CLI de Scaffold Gráfico (new-service)
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Insere novos projetos de maneira interativa e gera o compose correspondente sem duplicidade.
                  </p>
                </div>

                {formSuccess && (
                  <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <div>
                      <p className="font-bold">Serviço Cadastrado!</p>
                      <p className="text-xs text-slate-400">O arquivo `projects.yml` foi atualizado e o respectivo compose foi criado na pasta `compose/`.</p>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="mb-6 p-4 bg-rose-950/50 border border-rose-500/30 text-rose-300 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    <p className="text-xs font-bold font-mono">{formError}</p>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nome */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-slate-400 uppercase">Nome do Serviço</label>
                      <input 
                        type="text" 
                        required
                        placeholder="ex: minha-api, blog"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                      />
                    </div>

                    {/* Repo */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-slate-400 uppercase">URL do Repositório Git (SSH)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="git@github.com:usuario/projeto.git"
                        value={formData.repo}
                        onChange={(e) => setFormData({ ...formData, repo: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                      />
                    </div>

                    {/* Grupo */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-slate-400 uppercase">Grupo / Pasta do Projeto</label>
                      <input 
                        type="text" 
                        placeholder="ex: pessoal, backend, frontend"
                        value={formData.group}
                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500 font-mono">Será mapeado em mnt/grupo/projeto</p>
                    </div>

                    {/* Stack Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-slate-400 uppercase">Stack de Execução</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stack: "node" })}
                          className={`p-2.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                            formData.stack === "node"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          Node.js (Vue, React, Vite)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stack: "php" })}
                          className={`p-2.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                            formData.stack === "php"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          PHP (Nginx + FPM)
                        </button>
                      </div>
                    </div>

                    {/* Condicional STACK: NODE */}
                    {formData.stack === "node" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold font-mono text-slate-400 uppercase">Versão do Node</label>
                          <select
                            value={formData.node_version}
                            onChange={(e) => setFormData({ ...formData, node_version: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                          >
                            <option value="16">Node 16</option>
                            <option value="18">Node 18</option>
                            <option value="20">Node 20</option>
                            <option value="22">Node 22</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold font-mono text-slate-400 uppercase">Framework</label>
                          <select
                            value={formData.framework}
                            onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                          >
                            <option value="vite">Vite (Vue 3 / React)</option>
                            <option value="vue-cli">Vue CLI (Vue 2)</option>
                            <option value="other">Outros / Node puro</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold font-mono text-slate-400 uppercase">Porta do Container</label>
                          <input 
                            type="number" 
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    {/* Condicional STACK: PHP */}
                    {formData.stack === "php" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold font-mono text-slate-400 uppercase">Versão do PHP</label>
                          <select
                            value={formData.php_version}
                            onChange={(e) => setFormData({ ...formData, php_version: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                          >
                            <option value="8.0">PHP 8.0</option>
                            <option value="8.1">PHP 8.1</option>
                            <option value="8.2">PHP 8.2</option>
                            <option value="8.3">PHP 8.3</option>
                          </select>
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end pb-3">
                          <label className="flex items-center gap-2.5 text-sm font-mono text-slate-300 font-medium cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={formData.with_db}
                              onChange={(e) => setFormData({ ...formData, with_db: e.target.checked })}
                              className="w-4.5 h-4.5 rounded text-emerald-500 border-slate-800 focus:ring-0 cursor-pointer"
                            />
                            <span>Criar banco de dados dedicado</span>
                          </label>
                        </div>

                        {formData.with_db && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold font-mono text-slate-400 uppercase">Engine do Banco</label>
                            <select
                              value={formData.db_engine}
                              onChange={(e) => setFormData({ ...formData, db_engine: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                            >
                              <option value="mysql">MySQL 8.0</option>
                              <option value="postgres">PostgreSQL 15</option>
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* Hostname */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-slate-400 uppercase">Hostname Virtual (.local)</label>
                      <input 
                        type="text" 
                        placeholder={formData.name ? `${formData.name.toLowerCase()}.local` : "meu-servico.local"}
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono text-slate-400 uppercase">Descrição do Serviço (Gera Bloco COMMENT)</label>
                    <textarea 
                      rows={2}
                      placeholder="Breve comentário explicativo do que este container faz."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none resize-none"
                    />
                  </div>

                  {/* Caminho .env.example */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono text-slate-400 uppercase">Caminho do .env.example (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="ex: api/.env.example (se não estiver na raiz do repositório)"
                      value={formData.env_example}
                      onChange={(e) => setFormData({ ...formData, env_example: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-sm font-mono focus:outline-none"
                    />
                  </div>

                  <div className="border-t border-slate-800/80 pt-6 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-sm font-mono transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/15"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Cadastrar Serviço e Gerar Compose
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* EXPLORADOR DE ARQUIVOS VIEW */}
            {activeTab === "files" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-6"
              >
                {/* Seleção do arquivo */}
                <div className="md:col-span-1 bg-slate-900 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-2 px-2">Estrutura do Orquestrador</p>
                  
                  {files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFile(file.name)}
                      className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-mono transition-all ${
                        selectedFile === file.name 
                          ? "bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-500" 
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                      }`}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </div>

                {/* Conteúdo do arquivo selecionado */}
                <div className="md:col-span-3 bg-slate-900 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden h-[550px]">
                  <div className="bg-slate-900/50 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {selectedFile}
                    </span>
                    <button
                      onClick={() => handleCopy(getFileContent(), selectedFile)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 transition-all cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedFile === selectedFile ? "Copiado!" : "Copiar Código"}
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto p-5 bg-slate-950 font-mono text-xs leading-relaxed text-slate-300 select-text">
                    <pre className="whitespace-pre">{getFileContent()}</pre>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TERMINAL VIEW */}
            {activeTab === "terminal" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden h-[550px]"
              >
                {/* Terminal Header */}
                <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-mono font-bold text-slate-400 ml-2">dev-terminal @ localhost</span>
                  </div>
                  <button
                    onClick={() => setTerminalLogs([])}
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    Limpar Logs
                  </button>
                </div>

                {/* Logs Area */}
                <div className="flex-1 bg-slate-950 p-5 overflow-auto font-mono text-xs space-y-1.5 select-text">
                  {terminalLogs.map((log, index) => {
                    let style = "text-slate-300";
                    if (log.type === "stderr") style = "text-rose-400";
                    if (log.type === "info") style = "text-blue-400 font-bold";
                    if (log.type === "success") style = "text-emerald-400 font-bold";
                    if (log.type === "error") style = "text-rose-400 font-bold";

                    return (
                      <div key={index} className={`${style} whitespace-pre-wrap leading-relaxed`}>
                        {log.text}
                      </div>
                    );
                  })}
                  {isRunningScript && (
                    <div className="text-emerald-500 animate-pulse font-bold mt-2">
                      ⚡ Processando script no container... Por favor aguarde.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center font-mono text-[10px] text-slate-500 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          Orquestrador de Ambiente de Desenvolvimento Local. Siga os passos e use como quiser!
        </div>
        <div>
          Feito sob medida • Charles Müller
        </div>
      </footer>

    </div>
  );
}
