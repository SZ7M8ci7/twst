import cards from '@/assets/chara.json';
import { createResourceBattleHost } from './resourceBattleHost';
import { ComparisonError, runComparison, type ComparisonRequest } from '@/domain/examSearch/comparison';

let stopped = false, active = false;
self.onmessage = async ({ data }: MessageEvent<{ method: 'start'; request: ComparisonRequest } | { method: 'stop' }>) => {
  if (data.method === 'stop') { stopped = true; return; }
  if (active) return;
  active = true; stopped = false;
  try {
    await runComparison(data.request, Object.fromEntries(cards.map(c => [c.name, c])), createResourceBattleHost(),
      progress => self.postMessage({ progress }), result => self.postMessage({ result }), () => stopped);
    self.postMessage({ done: true, stopped });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error),
    errorCode: error instanceof ComparisonError ? error.code : undefined }); }
  finally { active = false; }
};
