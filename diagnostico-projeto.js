const fs = require("fs");
const path = require("path");

const IGNORAR = ["node_modules", ".git", ".vscode"];

function listarArquivos(dir, nivel = 0) {
  let resultado = "";
  const arquivos = fs.readdirSync(dir);

  for (const arquivo of arquivos) {
    if (IGNORAR.includes(arquivo)) continue;

    const caminhoCompleto = path.join(dir, arquivo);
    const stats = fs.statSync(caminhoCompleto);

    resultado += `${"  ".repeat(nivel)}- ${arquivo}\n`;

    if (stats.isDirectory()) {
      resultado += listarArquivos(caminhoCompleto, nivel + 1);
    }
  }

  return resultado;
}

function lerArquivoSeguro(caminho) {
  try {
    return fs.readFileSync(caminho, "utf8");
  } catch {
    return "❌ Arquivo não encontrado\n";
  }
}

let relatorio = "";
relatorio += "📌 DIAGNÓSTICO DO PROJETO\n\n";

// Estrutura
relatorio += "📁 ESTRUTURA DE PASTAS E ARQUIVOS\n";
relatorio += listarArquivos(process.cwd());
relatorio += "\n";

// package.json
relatorio += "📦 package.json\n";
relatorio += lerArquivoSeguro("package.json");
relatorio += "\n";

// README
relatorio += "📄 README.md\n";
relatorio += lerArquivoSeguro("README.md");
relatorio += "\n";

// server principal (tentativas comuns)
relatorio += "🚀 ARQUIVO PRINCIPAL DO SERVIDOR\n";
relatorio += lerArquivoSeguro("server.js");
relatorio += lerArquivoSeguro("app.js");
relatorio += lerArquivoSeguro("index.js");
relatorio += "\n";

// Firebase (se existir)
relatorio += "🔥 CONFIGURAÇÕES DE FIREBASE\n";
relatorio += lerArquivoSeguro("firebase.js");
relatorio += lerArquivoSeguro("src/firebase.js");
relatorio += "\n";

// Rotas (se existir)
relatorio += "🛣️ ROTAS (routes)\n";
if (fs.existsSync("routes")) {
  relatorio += listarArquivos("routes");
} else {
  relatorio += "❌ Pasta routes não encontrada\n";
}
relatorio += "\n";

// Views (EJS, HTML etc.)
relatorio += "🖥️ VIEWS / TELAS\n";
if (fs.existsSync("views")) {
  relatorio += listarArquivos("views");
} else {
  relatorio += "❌ Pasta views não encontrada\n";
}
relatorio += "\n";

fs.writeFileSync("RELATORIO_PROJETO.txt", relatorio, "utf8");

console.log("✅ Diagnóstico concluído!");
console.log("📄 Arquivo gerado: RELATORIO_PROJETO.txt");
