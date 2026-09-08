import type { IslandRequest } from './examSearchIslandRuntime';

type RuntimeModule = typeof import('./examSearchIslandRuntime');
type BootstrapMessage = {
  id: number;
  island: number;
  boot?: { stage: 'loading' | 'loaded'; url: string };
  bootstrapError?: { message: string; stack?: string; url: string; diagnostic: BootstrapDiagnostic };
};
type BootstrapDiagnostic = { bootstrapUrl: string; runtimeSpecifier: string; failedUrl?: string;
  resources: Array<{ name: string; responseStatus: number | null; duration: number }> };

// Keep diagnostics tied to the loaded bootstrap module; resolving a .ts URL
// here would make Vite emit an extra raw source asset in production builds.
const bootstrapUrl = import.meta.url;
let runtimePromise: Promise<RuntimeModule> | undefined;
let runtime: ReturnType<RuntimeModule['createIslandRuntime']> | undefined;
let active = false;
let pending: IslandRequest | undefined;
let stopRequested = false;

function islandOf(data: IslandRequest) { return 'island' in data ? data.island : -1; }
function emit(message: BootstrapMessage | Record<string, unknown>) { self.postMessage(message); }
function bootstrapDiagnostic(error: Error): BootstrapDiagnostic {
  const failedUrl = error.message.match(/https?:\/\/[^\s)]+/)?.[0];
  const entries = typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function' ? [] : performance.getEntriesByType('resource');
  const resources = entries
    .filter(entry => /\.(?:[cm]?js|ts|vue)(?:[?#]|$)/i.test(entry.name) || entry.name.includes('examSearch') || entry.name.includes('worker') ||
      ('responseStatus' in entry && (entry as PerformanceResourceTiming).responseStatus === 0))
    .slice(-100)
    .map(entry => ({ name: entry.name, responseStatus: 'responseStatus' in entry ? (entry as PerformanceResourceTiming).responseStatus : null,
      duration: entry.duration }));
  return { bootstrapUrl: bootstrapUrl, runtimeSpecifier: './examSearchIslandRuntime', failedUrl, resources };
}

async function processRequest(data: IslandRequest) {
  const island = islandOf(data);
  emit({ id: data.id, island, boot: { stage: 'loading', url: bootstrapUrl } });
  try {
    runtimePromise ??= import('./examSearchIslandRuntime');
    const module = await runtimePromise;
    runtime ??= module.createIslandRuntime(message => emit(message));
    emit({ id: data.id, island, boot: { stage: 'loaded', url: bootstrapUrl } });
    await runtime.handle(data, stopRequested);
  } catch (error) {
    const exception = error instanceof Error ? error : new Error(String(error));
    const diagnostic = bootstrapDiagnostic(exception);
    console.error('[exam-search] island bootstrap failed', diagnostic, exception);
    emit({ id: data.id, island, bootstrapError: { message: exception.message, stack: exception.stack, url: bootstrapUrl, diagnostic } });
    runtimePromise = undefined;
  } finally {
    pending = undefined;
    active = false;
    stopRequested = false;
  }
}

self.onmessage = ({ data }: MessageEvent<IslandRequest>) => {
  if (data.method === 'stop') {
    stopRequested = true;
    runtime?.stop();
    return;
  }
  if (active || pending) return;
  active = true;
  pending = data;
  void processRequest(data);
};
