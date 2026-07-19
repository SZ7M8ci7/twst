import { createRenderer } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import ja from '@/i18n/ja.json';
import en from '@/i18n/en.json';
import workerHost from '../generated/examAutoBestWorkerHost';

type WorkerRequest = {
  id: number;
  method: 'runPartition';
  snapshot?: unknown;
  resetStop?: boolean;
  seedText: string;
  rootRange: { start: number; end: number };
} | { id: number; method: 'warmup' }
  | { method: 'stop' };

const createNode = () => ({ parent: null as any, children: [] as any[] });
const renderer = createRenderer<any, any>({
  patchProp: () => undefined,
  insert: (child, parent) => { child.parent = parent; parent.children.push(child); },
  remove: () => undefined,
  createElement: createNode,
  createText: (text) => ({ ...createNode(), text }),
  createComment: (text) => ({ ...createNode(), text }),
  setText: (node, text) => { node.text = text; },
  setElementText: (node, text) => { node.text = text; },
  parentNode: (node) => node.parent,
  nextSibling: () => null,
  querySelector: () => null,
  setScopeId: () => undefined,
  cloneNode: (node) => ({ ...node, children: [...node.children] }),
  insertStaticContent: () => { const node = createNode(); return [node, node]; },
});

let simulatorPromise: Promise<any> | null = null;
function getSimulator() {
  if (!simulatorPromise) {
    simulatorPromise = Promise.resolve().then(() => {
      const component = workerHost as any;
      component.render = () => null;
      const app = renderer.createApp(component);
      app.use(createPinia());
      app.use(createI18n({ legacy: false, locale: 'ja', messages: { ja, en } }));
      return app.mount(createNode()) as any;
    });
  }
  return simulatorPromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const simulator = await getSimulator();
    if (event.data.method === 'warmup') {
      self.postMessage({ id: event.data.id, ready: true });
      return;
    }
    if (event.data.method === 'stop') {
      simulator.requestAutoBestWorkerStop();
      return;
    }
    const request = event.data;
    const result = await simulator.runAutoBestWorkerPartition(
      request.snapshot ?? null,
      request.seedText,
      request.rootRange,
      (exploredNodes: number, completedPatterns: number, queuedBranches: number, provisionalBestScore: number) => {
        self.postMessage({ id: request.id, progress: { exploredNodes, completedPatterns, queuedBranches, provisionalBestScore } });
      },
      request.resetStop === true,
    );
    self.postMessage({ id: request.id, result });
  } catch (error) {
    const id = 'id' in event.data ? event.data.id : -1;
    self.postMessage({ id, error: error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error) });
  }
};
