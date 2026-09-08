import { createRenderer } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import { routerKey } from 'vue-router';
import ja from '@/i18n/ja.json';
import host from '@/generated/examAutoBestWorkerHost';
import type { BattleEngine } from '@/domain/examSearch/types';

// Runs the existing simulator without a DOM. Keep the adapter small while the
// battle state machine is still hosted in examSimulator.vue.
export function createResourceBattleHost(): BattleEngine {
  const node = (): any => ({ parent: null, children: [] });
  const renderer = createRenderer<any, any>({
    patchProp: () => undefined, insert: (child, parent) => { child.parent = parent; parent.children.push(child); },
    remove: () => undefined, createElement: node, createText: node, createComment: node,
    setText: () => undefined, setElementText: () => undefined,
    parentNode: n => n.parent, nextSibling: () => null, querySelector: () => null,
    setScopeId: () => undefined, cloneNode: n => ({ ...n }), insertStaticContent: () => [node(), node()],
  });
  const component = host as any;
  component.render = () => null;
  const app = renderer.createApp(component);
  app.use(createPinia());
  app.use(createI18n({ legacy: false, locale: 'ja', messages: { ja } }));
  app.provide(routerKey, { currentRoute: { value: { query: {} } } } as any);
  const simulator = app.mount(node()) as any;
  return { prepare: (input, candidate) => simulator.prepareResourceCandidate(input, candidate),
    trial: (seed, policy, log) => simulator.runResourceTrial(seed, policy, log),
    scout: (seed, policy, cardIndex, idealHand, magic) => simulator.scoutResourceCritical(seed,policy,cardIndex,idealHand,magic),
    scoutTargets: () => simulator.resourceCriticalTargets(),
    importanceTrial: (seed,policy) => simulator.runResourceImportanceTrial(seed,policy),
    replay: (seed, plan, log) => simulator.replayResourceTrial(seed, plan, log),
    learnPlan: (seed, durationMs) => simulator.learnResourcePlan(seed, durationMs),
    learnCriticalPlan: (seed,durationMs,cardIndex,idealHand,magic) => simulator.learnResourceCriticalPlan(seed,durationMs,cardIndex,idealHand,magic) };
}
