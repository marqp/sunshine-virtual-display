import prompts from 'prompts';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Compatibilidade para ambientes híbridos (Node.js/Bun) e módulos ES (ESM).
 * Resolve __filename e __dirname pois eles não existem nativamente no escopo ESM.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Procura dinamicamente o executável do Sunshine no sistema.
 * Ideal para suportar instalações via Homebrew, pacote nativo (.app), ou build manual.
 */
function findSunshineBin(): string {
  try {
    const binPath = execSync('which sunshine', { encoding: 'utf8' }).trim();
    if (binPath) return binPath;
  } catch {
    /* Ignora se 'which' falhar e avança para os fallbacks */
  }

  const commonPaths = [
    '/opt/homebrew/bin/sunshine',
    '/usr/local/bin/sunshine',
    '/Applications/Sunshine.app/Contents/MacOS/sunshine',
    '/opt/homebrew/opt/sunshine/bin/sunshine'
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error('Sunshine não encontrado. Certifique-se de que está instalado ou no seu $PATH.');
}

/**
 * Detecta se existe um dispositivo Android conectado e autorizado via ADB.
 * @returns O ID do dispositivo ou null se nenhum dispositivo for encontrado.
 */
function getAdbDeviceId(): string | null {
  try {
    const output = execSync('adb devices', { encoding: 'utf8' }).trim();
    const lines = output.split('\n');
    // Procuramos a primeira linha que contenha um dispositivo ativo e autorizado
    const deviceLine = lines.find((line) => line.includes('\tdevice'));
    if (deviceLine) {
      return deviceLine.split('\t')[0].trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica se o binário do gnirehtet está instalado no sistema.
 */
function hasGnirehtet(): boolean {
  try {
    execSync('which gnirehtet', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

const SUNSHINE_BIN = findSunshineBin();
const SUNSHINE_CONF = path.join(os.homedir(), '.config/sunshine/sunshine.conf');

let gnirehtetProcess: ReturnType<typeof spawn> | null = null;

async function main() {
  console.clear();
  console.log('=========================================');
  console.log(' ☀️ Sunshine Native Auto-Provision (TS) ☀️ ');
  console.log('=========================================\n');

  let unplugInterval: NodeJS.Timeout | null = null;

  // Fixamos a resolução em 1080p. O ajuste fino é feito via Configurações de Sistema do macOS
  const width = 1920;
  const height = 1080;

  // 1. Otimização de Performance (Background Provisioning)
  // Como a resolução já é conhecida, disparamos a criação da tela virtual nativa no SO em paralelo.
  // Isso mascara a latência de inicialização enquanto o usuário lê e escolhe as opções do menu.
  console.log('⏳ Provisionando monitor virtual em background...');
  const daemonPath = path.join(__dirname, 'display-daemon.js');
  const displayProcess = spawn('node', [daemonPath, width.toString(), height.toString()], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  let displayId: string | null = null;

  // Extrai o ID do display nativo a partir da saída (logs) do processo daemon C++
  const waitForDisplay = new Promise<string>((resolve, reject) => {
    let outputBuffer = '';

    // Flag para evitar rejeições tardias de derrubarem o processo pai
    let isResolved = false;

    const processOutput = (data: Buffer) => {
      if (isResolved) return;
      const chunk = data.toString();
      outputBuffer += chunk;

      const match = outputBuffer.match(/Virtual display created with ID:\s*(\d+)/);
      if (match) {
        isResolved = true;
        resolve(match[1]);
      }
    };

    if (displayProcess.stdout) displayProcess.stdout.on('data', processOutput);
    if (displayProcess.stderr) displayProcess.stderr.on('data', processOutput);

    // Escuta erros emitidos pelo daemon via canal IPC
    displayProcess.on('message', (msg: any) => {
      if (!isResolved && msg.type === 'ERROR') reject(new Error(msg.message));
    });

    displayProcess.on('error', (err) => {
      if (!isResolved) reject(err);
    });

    displayProcess.on('exit', (code) => {
      // Só consideramos erro se saiu antes de nos dar o ID de sucesso
      if (!isResolved) {
        reject(new Error(`Daemon do monitor encerrou prematuramente com código ${code}`));
      } else {
        // Se o daemon fechar *após* estar resolvido, o cleanup chamará exit depois de matar o sunshine
        console.log(`\n⚠️  Daemon do monitor virtual encerrado (código ${code}).`);
        if (typeof cleanup === 'function') cleanup();
      }
    });

    // Timeout de 10s (aumentado pois o usuário pode demorar no menu)
    setTimeout(() => {
      if (!isResolved) reject(new Error('Timeout aguardando inicialização do monitor.'));
    }, 10000);
  });

  // Verifica se o modo Headless/CI foi solicitado (pula o menu interativo)
  const isCiMode = process.argv.includes('--ci');
  let q;
  let useUsbTethering = false;
  let connectedDeviceId: string | null = null;

  if (isCiMode) {
    console.log('🤖 Modo --ci ativado. Selecionando perfil Equilibrado automaticamente...');
    q = { minBit: 15000, maxBit: 30000, sw: 'fast' };
  } else {
    // 1.5. Verificação de Tethering USB
    const adbDeviceId = getAdbDeviceId();
    const gnirehtetReady = hasGnirehtet();

    if (adbDeviceId && gnirehtetReady) {
      const tetherResponse = await prompts({
        type: 'confirm',
        name: 'useUsbTethering',
        message:
          '🔌 Dispositivo Android detectado via cabo. Deseja ativar o Modo Turbo USB (Gnirehtet)?',
        initial: true
      });
      useUsbTethering = tetherResponse.useUsbTethering;
      if (useUsbTethering) connectedDeviceId = adbDeviceId;
    } else if (adbDeviceId && !gnirehtetReady) {
      console.log('🔌 Dispositivo Android detectado, mas o Gnirehtet não está instalado.');
      console.log(
        '💡 Dica: Instale com `brew install gnirehtet` para habilitar o Modo Turbo USB.\n'
      );
    }

    // 2. Menu interativo para seleção de qualidade de transmissão
    const qualityResponse = await prompts({
      type: 'select',
      name: 'quality',
      message: '✨ Selecione a qualidade de transmissão:',
      choices: [
        {
          title: '🎮 Competitivo (Latência Ultra Baixa)',
          value: { minBit: 5000, maxBit: 15000, sw: 'fast' }
        },
        {
          title: '⚖️  Equilibrado (Fluidez e Nitidez)',
          value: { minBit: 15000, maxBit: 30000, sw: 'fast' }
        },
        {
          title: '🍿 Cinematográfico (Qualidade Máxima)',
          value: { minBit: 30000, maxBit: 60000, sw: 'medium' }
        }
      ],
      initial: 1
    });

    if (!qualityResponse.quality) {
      console.log('❌ Operação cancelada.');
      if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
      process.exit(1);
    }

    q = qualityResponse.quality;
  }

  console.log(`\n✅ Resolução: ${width}x${height} | Target Bitrate: ${q.maxBit / 1000}Mbps\n`);

  try {
    // 3. Aguarda a inicialização (se já não estiver pronta)
    displayId = await waitForDisplay;
    console.log(`✅ Monitor inicializado nativamente! (CGDirectDisplayID: ${displayId})`);
  } catch (err: any) {
    console.error(`❌ Erro ao criar monitor: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  // 3. Injeta configuração dinâmica no arquivo sunshine.conf (Estado da Arte no macOS)
  // Associa a transmissão diretamente ao Virtual Display recém-criado
  console.log('⚙️  Otimizando Sunshine via ScreenCaptureKit...');

  const sunshineConfig = [
    `output_name = ${displayId}`,
    `min_bitrate = ${q.minBit}`,
    `max_bitrate = ${q.maxBit}`,
    `sw_preset = ${q.sw}`,
    `sw_tune = zerolatency`,
    `min_log_level = info`
  ].join('\n');

  try {
    const configDir = path.dirname(SUNSHINE_CONF);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Escrita atômica (Atomic Write):
    // Grava primeiro num temp file e renomeia para evitar corrupção de arquivo
    const tempConfigPath = `${SUNSHINE_CONF}.tmp.${Date.now()}`;
    fs.writeFileSync(tempConfigPath, sunshineConfig);
    fs.renameSync(tempConfigPath, SUNSHINE_CONF);
  } catch (err: any) {
    console.error(`❌ Erro ao salvar configuração: ${err.message}`);
    if (displayProcess && !displayProcess.killed) displayProcess.kill('SIGINT');
    process.exit(1);
  }

  // 4. Executa Sunshine com a nova configuração configurada dinamicamente
  console.log('🚀 Iniciando Sunshine...\n');
  const sunshineProcess = spawn(SUNSHINE_BIN, [SUNSHINE_CONF], {
    stdio: 'inherit' // Mantém os logs do Sunshine no terminal atual para debug do usuário
  });

  if (useUsbTethering) {
    console.log('🔌 Iniciando túnel USB (Gnirehtet)...');
    gnirehtetProcess = spawn('gnirehtet', ['run'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (gnirehtetProcess.stderr) {
      gnirehtetProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        // Loga apenas mensagens importantes do Gnirehtet, evitando flood de info
        if (msg.includes('Exception') || msg.includes('Error') || msg.includes('fail')) {
          console.error(`[Gnirehtet] ${msg.trim()}`);
        }
      });
    }

    console.log('\n======================================================');
    console.log(' ℹ️  TÚNEL USB ATIVO: Conecte o Moonlight ao IP 10.0.2.2');
    console.log('======================================================\n');

    /**
     * Monitoramento de hardware:
     * Verifica periodicamente se o cabo USB foi removido ou se a depuração foi desativada.
     * Se o ID do dispositivo sumir ou mudar, encerramos tudo imediatamente por segurança.
     */
    unplugInterval = setInterval(() => {
      const currentId = getAdbDeviceId();
      if (!currentId || currentId !== connectedDeviceId) {
        console.log('\n🔌 Cabo USB desconectado. Encerrando sessão...');
        cleanup();
      }
    }, 3000); // Verifica a cada 3 segundos
  }

  // 5. Teardown / Cleanup: Encerramento de processos
  let isShuttingDown = false;

  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (unplugInterval) clearInterval(unplugInterval);

    console.log('\n=========================================');
    console.log(' 🧹 Encerrando processos e limpando...   ');
    console.log('=========================================');

    if (gnirehtetProcess && !gnirehtetProcess.killed) {
      console.log('-> Fechando túnel USB (Gnirehtet)...');
      gnirehtetProcess.kill('SIGINT');
    }

    if (sunshineProcess && !sunshineProcess.killed) {
      console.log('-> Solicitando encerramento do Sunshine...');
      sunshineProcess.kill('SIGTERM'); // Tenta fechamento gracioso primeiro (Graceful Degradation)

      // Fallback para SIGKILL agressivo se o Sunshine travar e demorar mais de 2s
      setTimeout(() => {
        if (!sunshineProcess.killed) sunshineProcess.kill('SIGKILL');
      }, 2000);
    }

    if (displayProcess && !displayProcess.killed) {
      console.log('-> Destruindo virtual display nativo...');
      displayProcess.kill('SIGINT');
    }

    // Dá um pequeno atraso para os processos morrerem graciosamente no OS
    setTimeout(() => {
      console.log('✅ Feito. Até logo!');
      process.exit(0);
    }, 500);
  };

  // Intercepta fechamento da janela ou Ctrl+C para garantir teardown correto
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Se o servidor Sunshine fechar sozinho (crash), iniciamos o cleanup geral
  sunshineProcess.on('exit', () => {
    console.log('\n⚠️  Sunshine foi encerrado.');
    cleanup();
  });
}

main().catch((err) => {
  console.error('Erro não tratado:', err);
  process.exit(1);
});
