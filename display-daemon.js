/**
 * display-daemon.js
 *
 * Este processo secundário roda em background e é responsável exclusivamente por
 * criar e gerenciar o ciclo de vida do Virtual Display nativo do macOS.
 * É isolado do processo principal para garantir estabilidade e evitar vazamento
 * de recursos (Memory Leaks) caso o processo pai sofra um crash inesperado.
 */
import VirtualDisplay from 'node-mac-virtual-display';

// Argumentos passados via spawn no processo principal
const width = parseInt(process.argv[2], 10);
const height = parseInt(process.argv[3], 10);
const displayName = process.argv[4] || 'Sunshine Virtual Display';

const vdisplay = new VirtualDisplay();

try {
  // Instantiate the virtual screen in macOS and capture the returned ID/info
  const displayResult = vdisplay.createVirtualDisplay({
    width: width,
    height: height,
    frameRate: 60,
    hiDPI: true,
    displayName: displayName,
    mirror: false
  });

  /**
   * node-mac-virtual-display returns a Display Object.
   * We need to extract the numerical/string ID for Sunshine targeting.
   */
  const displayId =
    displayResult && typeof displayResult === 'object'
      ? displayResult.id || displayResult.displayId || displayResult.displayID
      : displayResult;

  // Emit success cleanly via IPC channel
  if (process.send) {
    process.send({ type: 'SUCCESS', id: displayId || 'Unknown' });
  } else {
    // Fallback to stdout if run manually
    console.log(`Virtual display created with ID: ${displayId}`);
  }

  // Keep alive: Keeps the Event Loop running so the process doesn't close immediately
  setInterval(() => {}, 1000);

  // Função de limpeza que destrói o display virtual no SO
  const cleanup = () => {
    try {
      vdisplay.destroyVirtualDisplay();
    } catch {
      // Ignora erros na destruição (já pode estar morto)
    }
    process.exit(0);
  };

  // Parent Death Detection: Se o processo principal (pai) morrer/crashar,
  // o canal IPC desconecta, disparando a destruição do monitor zumbi.
  process.on('disconnect', () => {
    cleanup();
  });

  // Escuta sinais de término enviados pelo OS ou processo pai
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
} catch (err) {
  // Reporta erro ao processo principal via IPC (se disponível)
  if (process.send) process.send({ type: 'ERROR', message: err.message });
  console.error('FATAL:', err);
  process.exit(1);
}
