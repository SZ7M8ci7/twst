import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const harnessHash=createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');

function cleanFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9\u3040-\u30ff\u3400-\u9fff.-]/g, '_');
}

function deckKey(candidate) {
  return JSON.stringify(candidate.cards.map(card => [card.name, !!card.support]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}


function constraintCheck(input, candidate, catalog, profile) {
  const challengeIds = (input.preset.specialChallenges ?? []).map(challenge => challenge.id).sort();
  const actualIds = [...(candidate.challengeIds ?? [])].sort();
  const characters = new Set(candidate.cards.map(card => catalog[card.name]?.chara).filter(Boolean));
  const rosterNames = new Set(input.roster.map(card => card.name));
  const supportNames = new Set(input.supports.map(card => card.name));
  const supportCount = candidate.cards.filter(card => card.support).length;
  const expectedSupportCount = input.preset.title.includes('統一') || (input.preset.specialChallenges?.length ?? 0) > 0 ? 1 : 0;
  const cardsAreKnown = candidate.cards.length === 5 && candidate.cards.every(card => !!catalog[card.name]
    && (card.support ? supportNames.has(card.name) : rosterNames.has(card.name)));
  const ownedCards = candidate.cards.filter(card => !card.support);
  const uniqueCards = new Set(ownedCards.map(card => card.name)).size === ownedCards.length;
  const expectedBudget = candidate.cards.reduce((sum, card) => {
    const original = (card.support ? input.supports : input.roster).find(entry => entry.name === card.name);
    return sum + Math.max(0, (card.totsu ?? 0) - (original?.totsu ?? 0));
  }, 0);
  const levelsLegal = candidate.cards.every(card => {
    const original = (card.support ? input.supports : input.roster).find(entry => entry.name === card.name);
    const expectedLevel = card.support ? original?.level : Math.min(120, (original?.level ?? 0) + Math.max(0, (card.totsu ?? 0) - (original?.totsu ?? 0)) * 5);
    return Number.isFinite(card.level) && card.level === expectedLevel && Number.isFinite(card.level) && card.level >= 0 && card.level <= 120
      && Number.isInteger(card.totsu) && card.totsu >= (original?.totsu ?? 0) && card.totsu <= 4
      && Array.isArray(card.magicLevels) && card.magicLevels.length === 3 && card.magicLevels.every(level => level >= 0 && level <= 10)
      && Array.isArray(card.buddyLevels) && card.buddyLevels.length === 3 && card.buddyLevels.every(level => level >= 0 && level <= 10);
  });
  const supportRoleLegal = supportCount === expectedSupportCount && candidate.cards.every(card => card.support ? supportNames.has(card.name) : rosterNames.has(card.name));
  const requiredCharactersPresent = input.requiredCharacters.every(chara => characters.has(chara));
  const allChallengesOn = JSON.stringify(actualIds) === JSON.stringify(challengeIds);
  const budgetLegal = expectedBudget <= input.budget && candidate.cost <= input.budget;
  const profileRosterLegal = profile === 'all-owned' ? input.roster.length === 518 : input.roster.length > 0;
  return { cardsAreKnown, uniqueCards, requiredCharactersPresent, allChallengesOn, noSeedTeams: !input.seedTeams,
    budgetLegal, levelsLegal, supportRoleLegal, supportCount, expectedSupportCount, profileRosterLegal,
    ok: cardsAreKnown && uniqueCards && requiredCharactersPresent && allChallengesOn && !input.seedTeams
      && budgetLegal && levelsLegal && supportRoleLegal && profileRosterLegal };
}


export async function runHistoryCase({input,preset,entry,profile,tag,outputDir,durationMs,auditTrials,nonce,auditOnly=false,
  validationOnly=false,startingCheckpoint,sourceHash,modules}) {
  const {createResourceBattleHost,SearchSession,runSessionWithinBudget,metrics,scoreDistribution,autoScoreMetrics,compareAutoResults,searchDevelopmentQuality,ENGINE_VERSION,catalog,displayProgress,rankedResults}=modules;
  const caseId=preset.id;
function saveJson(file, value) {
  const target = path.isAbsolute(file) ? file : path.join(outputDir, file);
  const temporary = `${target}.${process.pid}.pending`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  try { fs.rmSync(target, { force: true }); } catch { /* an old report is still recoverable in git */ }
  fs.renameSync(temporary, target);
}


    const fingerprint = JSON.stringify(input);
    const checkpointFile = `checkpoint-${cleanFilePart(profile)}-${cleanFilePart(caseId)}.json`;
    const reportFile = `case-${cleanFilePart(profile)}-${cleanFilePart(caseId)}.json`;
    const checkpointPath = path.join(outputDir, checkpointFile);
    const saved = fs.existsSync(checkpointPath) ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) : null;
    if(saved&&saved.sourceHash!==sourceHash)throw new Error(`Checkpoint source mismatch for ${profile}/${caseId}`);
    if(saved&&(saved.nonce!==nonce||saved.inputFingerprint!==fingerprint))throw new Error(`Checkpoint input/nonce mismatch for ${profile}/${caseId}`);
    if(saved&&saved.engineVersion!==ENGINE_VERSION)throw new Error(`Checkpoint engine mismatch for ${profile}/${caseId}`);
    const previous = saved?.nonce === nonce && saved?.inputFingerprint === fingerprint ? saved.checkpoint : startingCheckpoint;
    if(validationOnly&&!previous?.finalists.length)throw new Error('Validation-only comparison requires fixed finalists');
    if (auditOnly && !previous) throw new Error(`Missing checkpoint for audit-only: ${profile}/${caseId}`);
    const engine = createResourceBattleHost();
    const session = new SearchSession(input, catalog, engine, nonce, previous);
    // Observer only: the source-specific helper decides whether to call this optional method.
    const tailInvocations = [];
    const tailSnapshot = () => {
      const c = session.checkpoint();
      return { elapsed: c.elapsed, generated: c.generatedCount, evaluated: c.evaluatedCount,
        trialSerial: c.trialSerial, diagnostics: c.tailValidation ? {...c.tailValidation} : null,
        finalists: c.finalists.map(r => ({id:r.candidate.id,n:r.validation.scores.length,
          target:r.validationTarget,complete:r.validation.scores.length>=r.validationTarget,
          best:r.validationBest ? {...r.validationBest} : null})) };
    };
    if (typeof session.runValidationTail === 'function') {
      const originalTail = session.runValidationTail.bind(session);
      session.runValidationTail = async (budget, publish) => {
        const observedStart = performance.now();
        const invocation = {budgetMs:budget, before:tailSnapshot(), snapshots:[]};
        tailInvocations.push(invocation);
        try { return await originalTail(budget, p => {
          invocation.snapshots.push({phase:p.phase,elapsedMs:p.elapsedMs,...tailSnapshot()});
          publish(p);
        }); } finally {
          invocation.after=tailSnapshot(); invocation.observedWallMs=performance.now()-observedStart;
        }
      };
    }
    const priorElapsed = Number(previous?.elapsed ?? 0);
    const remainingMs = Math.max(0, durationMs - priorElapsed);
    let progress = { phase: 'stopped', generated: previous?.seen?.length ?? 0, evaluated: previous?.evaluatedCount ?? 0,
      tasksDone: previous?.cursor ?? 0, tasksTotal: previous?.tasksTotal ?? 0, elapsedMs: priorElapsed,
      results: previous?.finalists ?? [] };
    let lastCheckpoint = 0;
    const started = performance.now();
    const cpuStart=process.cpuUsage(); let runPasses=0;
    const needsValidation=previous?.finalists.some(row=>row.validation.scores.length<row.validationTarget);
    if (remainingMs > 0 && !auditOnly && (!validationOnly||needsValidation)) {
      const runResult=await runSessionWithinBudget(session, Date.now() + remainingMs, current => {
        progress = current;
        if (current.elapsedMs - lastCheckpoint >= 5_000 || current.phase === 'done' || current.phase === 'stopped') {
          lastCheckpoint = current.elapsedMs;
          saveJson(checkpointPath, { schema: 'exam-search-generalization-checkpoint-v1', sourceHash, engineVersion: ENGINE_VERSION,
            profile, caseId, nonce, inputFingerprint: fingerprint, input, progress: current,
            checkpoint: { ...session.checkpoint(), elapsed: current.elapsedMs } });
        }
      }, { allowRepeat: !validationOnly, minimumRemainingMs: 15_000 });
      runPasses=runResult.passes;
    }
    const actualSearchWallMs=performance.now()-started;
    const searchCpu=process.cpuUsage(cpuStart);
    const checkpoint = { ...session.checkpoint(), elapsed: Math.max(session.checkpoint().elapsed, progress.elapsedMs) };
    const allResults = [...new Map([...checkpoint.pool, ...checkpoint.finalists]
      .map(result => [result.candidate.id, result])).values()];
    const finalistIds = new Set(checkpoint.finalists.map(result => result.candidate.id));
    if (!checkpoint.finalists.length) throw new Error(`No published finalists: ${profile}/${caseId}`);
    const resultSource = checkpoint.finalists;
    const productPacket=displayProgress({...progress,results:resultSource},input.attempts,input.desiredProbability);
    const productOrder=rankedResults(productPacket.results,input.attempts,input.desiredProbability).map(r=>r.candidate.id);
    const ranked = resultSource.map(result => {
      const developmentMetrics = autoScoreMetrics(result.development, input.attempts, input.desiredProbability);
      return { result, developmentMetrics,
        publishedMetrics: autoScoreMetrics(result.validation,input.attempts,input.desiredProbability),
        publishedDistribution: scoreDistribution(result.validation), finalist: finalistIds.has(result.candidate.id),
        rankingScore: searchDevelopmentQuality(result.development, input) };
    }).sort((a,b)=>productOrder.indexOf(a.result.candidate.id)-productOrder.indexOf(b.result.candidate.id));
    const top = [];
    const seenDecks = new Set();
    for (const row of ranked) {
      const key = deckKey(row.result.candidate);
      if (seenDecks.has(key)) continue;
      seenDecks.add(key); top.push(row);
      if (top.length >= 3) break;
    }
    const audited = [];
    const auditStart = performance.now();
    for (const [rank, row] of top.entries()) {
      const candidate = row.result.candidate;
      const legality = constraintCheck(input, candidate, catalog, profile);
      if (!legality.ok) throw new Error(`Illegal candidate ${profile}/${caseId}: ${JSON.stringify(legality)}`);
      await engine.prepare(input, candidate);
      const scores = [], retired = { count: 0, turns: 0 };
      let maxIndex = 0;
      for (let index = 0; index < auditTrials; index++) {
        const trial = engine.trial(`${nonce}:fresh-validation:${candidate.id}:${index}`, candidate.policy);
        scores.push(trial.score); retired.count += Number(trial.retired); retired.turns += trial.finishTurn;
        if (trial.score > (scores[maxIndex] ?? -Infinity)) maxIndex = index;
        if (index % 128 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      const distribution = scoreDistribution({ scores, retired: retired.count, turns: retired.turns });
      const validationMetrics = metrics({ scores, retired: retired.count, turns: retired.turns }, input.target, input.attempts);
      const validationAuto = autoScoreMetrics({ scores, retired: retired.count, turns: retired.turns }, input.attempts, input.desiredProbability);
      const seed = `${nonce}:fresh-validation:${candidate.id}:${maxIndex}`;
      const replay = auditTrials ? engine.trial(seed, candidate.policy, true) : null;
      if (replay && replay.score !== distribution.max) throw new Error(`Fresh audit replay mismatch for ${profile}/${caseId}`);
      const forcedReplay = replay ? engine.replay(seed, replay.plan, true) : null;
      if (forcedReplay && forcedReplay.score !== replay.score)
        throw new Error(`Explicit-plan score mismatch for ${profile}/${caseId}`);
      const sortedScores = [...scores].sort((a,b) => a-b);
      const expectedMaxOfAttempts = sortedScores.reduce((sum,score,index) => sum + score *
        (Math.pow((index+1)/sortedScores.length,input.attempts)-Math.pow(index/sortedScores.length,input.attempts)),0);
      audited.push({ rank: rank + 1, finalist: row.finalist, candidate, deckKey: deckKey(candidate), developmentMetrics: row.developmentMetrics,
        publishedMetrics: row.publishedMetrics, publishedDistribution: row.publishedDistribution,
        rankingScore: row.rankingScore, validation1024: { ...validationMetrics, auto: validationAuto, p95: distribution.p95,
          mean: scores.reduce((sum,score) => sum+score,0)/Math.max(1,scores.length),
          winRate: scores.filter(score => score>0).length/Math.max(1,scores.length), expectedMaxOfAttempts,
          optimism: (row.publishedMetrics.empiricalScore??0)-(validationAuto.empiricalScore??0),
          retired: retired.count, turns: retired.turns, trials: auditTrials, seed, replayScore: replay?.score ?? null } });
    }
    const constraints = audited.map(row => ({ rank: row.rank, ...constraintCheck(input, row.candidate, catalog, profile) }));
    const elapsedMs = performance.now() - started;
    const report = { rankingMethod:"actual displayProgress + rankedResults single-checkpoint", productTop1Id:productOrder[0], harnessHash, minimumRemainingMs:15000, runPasses, schedulerRound:checkpoint.round, mutationRound:checkpoint.mutationRound, harnessMode:'single-island-supplement-not-full-browser-equivalence', schema: 'exam-search-generalization-v1', engineVersion: ENGINE_VERSION, tag, profile, caseId,
      scope:validationOnly?'validation-only':'search',validationTrials:checkpoint.finalists.reduce((sum,row)=>sum+row.validation.scores.length,0),
      validationFinalists:checkpoint.finalists.map(row=>({id:row.candidate.id,samples:row.validation.scores.length,target:row.validationTarget,complete:row.validation.scores.length>=row.validationTarget})),
      preset: { id: preset.id, title: preset.title, kind: preset.kind, enemyElement: preset.enemyElement }, referenceScore: entry.score, nonce,
      durationMs, elapsedMs, actualSearchWallMs, tailDiagnostics:checkpoint.tailValidation??null, tailInvocations, searchElapsedMs: checkpoint.elapsed, searchCpuMicros: searchCpu, candidateCount: allResults.length, cpuSession: true, browserIslands: 0, storage: 'none', auditTrials,
      selection: checkpoint.finalists.length ? 'displayed-finalists' : 'development-fallback',
      generated: progress.generated, evaluated: progress.evaluated, tasksDone: progress.tasksDone, tasksTotal: progress.tasksTotal,
      checkpointSource: previous ? checkpointFile : null, checkpoint: checkpointFile, noReferenceSeeds: !input.seedTeams,
      input, topCandidates: audited, constraints, bestScore: audited.reduce((max, row) => Math.max(max, row.validation1024.max), 0),
      completedAt: new Date().toISOString() };
    saveJson(checkpointPath, { schema: 'exam-search-generalization-checkpoint-v1', sourceHash, engineVersion: ENGINE_VERSION,
      profile, caseId, nonce, inputFingerprint: fingerprint, input, progress: { ...progress, results: checkpoint.finalists }, checkpoint });
    saveJson(reportFile, report);

    return report;
}

export { cleanFilePart };
