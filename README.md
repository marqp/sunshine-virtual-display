# Sunshine Virtual Display (macOS) ☀️

Um wrapper interativo de linha de comando (CLI) feito em Node.js/TypeScript para criar **Telas Virtuais Nativas no macOS** e vinculá-las automaticamente ao servidor de streaming **Sunshine**. Ideal para quem quer fazer streaming sem um monitor físico ligado (Headless Mac).

## ✨ Funcionalidades

- **Monitor Virtual Nativo**: Cria monitores fantasmas em alta resolução sem adaptadores HDMI/Dummy usando APIs puras do macOS.
- **Auto-Provisionamento do Sunshine**: Descobre automaticamente a instalação do Sunshine (Homebrew ou .app) e sobrepõe configurações on-the-fly (`sunshine.conf`).
- **Menu Interativo (Presets)**: Perfis de bitrate pré-configurados:
  - 🎮 Competitivo (Latência Ultra Baixa)
  - ⚖️ Equilibrado (Fluidez e Nitidez)
  - 🍿 Cinematográfico (Qualidade Máxima)
- **Zero Vazamento de Memória**: Arquitetura IPC robusta com Parent Death Detection previne que as telas virtuais persistam caso o processo encerre inesperadamente (zumbis).
- **Alta Performance (Inicialização Concorrente)**: A criação do monitor nativo (que pode demorar alguns segundos) ocorre em _background_ simultaneamente à exibição do menu interativo. Isso zera a latência percebida pelo usuário ao iniciar a transmissão.
- **Modo Headless/Automação (`--ci`)**: Suporte a execução desassistida (sem menu interativo) aplicando o perfil Equilibrado por padrão. Perfeito para atalhos do macOS, KDE Connect, ou scripts de inicialização.
- **Compatibilidade Moderna**: Suporte a ESM e compilação híbrida; funciona perfeitamente com Bun e Node.js.

## 🚀 Como instalar

### Pré-requisitos

- macOS (Apple Silicon ou Intel)
- [Node.js](https://nodejs.org/) v18+ ou [Bun](https://bun.sh/)
- [Sunshine](https://app.lizardbyte.dev/Sunshine/) instalado (via Homebrew ou .pkg)

### Clonando e executando

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/sunshine-vd.git
cd sunshine-vd

# 2. Instale as dependências
npm install

# 3. Modo Interativo
npx tsx index.ts

# OU Modo Automatizado (Bypassa o menu e inicia no perfil Equilibrado)
npx tsx index.ts --ci
```

_(Dica: Para carregamento mais rápido, você pode rodar com `bun run index.ts`)_

## 🧑‍💻 Comandos de Desenvolvimento

Este repositório está padronizado para contribuições usando ESLint e Prettier:

```bash
npm run format # Formata o código
npm run lint   # Checa a qualidade do código com ESLint
```

## 🛠️ Arquitetura e Engenharia (Por Baixo do Capô)

Para garantir estabilidade, segurança e evitar bugs clássicos de manipulação de processos:

- **Escrita Atômica (Atomic Write)**: O arquivo de configuração do Sunshine (`sunshine.conf`) é manipulado com tolerância a falhas. Gravamos os dados em um `.tmp` e usamos `fs.renameSync` para que a escrita seja atômica no nível do SO, evitando arquivos corrompidos se o usuário der `Ctrl+C` no momento exato.
- **Isolamento e Concorrência**: A alocação da Tela Virtual ocorre num sub-processo (`display-daemon.js`). Além de proteger o processo principal contra travamentos em APIs nativas C++, isso nos permite provisionar a tela concorrentemente em background enquanto o usuário navega nos menus.
- **Teardown Gracioso (Graceful Degradation)**: Ao encerrar, o script prioriza enviar sinais de `SIGTERM` para permitir que o Sunshine limpe as portas e soquetes adequadamente antes de forçar o kill.

## 🤝 Contribuindo

Sinta-se à vontade para abrir Issues e enviar Pull Requests! Sugestões de novos presets e refinamentos no setup nativo são muito bem-vindos.

## 📜 Licença

Distribuído sob a licença GPL-3.0. Veja [LICENSE](LICENSE) para mais informações.
