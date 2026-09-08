export type BattleLogActionElement = '火' | '水' | '木' | '無';

export interface BattleLogEntry {
  line: string;
  displayLine: string;
  side: 'enemy' | 'player' | 'system';
  emphasized?: boolean;
  icon?: string;
  targetIcon?: string;
  sourceElement?: BattleLogActionElement;
  targetElement?: BattleLogActionElement;
  label?: string;
  targetLabel?: string;
}

export interface BattleLogGroup {
  title: string;
  entries: BattleLogEntry[];
}

export interface BattleLogParserOptions {
  playerIcon?: (line: string) => string;
}

export function groupExamBattleLog(lines: string[], options: BattleLogParserOptions = {}): BattleLogGroup[] {
  const groups: BattleLogGroup[] = [];
  lines.forEach((line) => {
    if (!shouldShowExamBattleLogLine(line)) return;
    const title = examBattleLogTurnTitle(line);
    let group = groups[groups.length - 1];
    if (!group || group.title !== title) {
      group = { title, entries: [] };
      groups.push(group);
    }
    group.entries.push(buildExamBattleLogEntry(line, options));
  });
  return groups;
}

export function shouldShowExamBattleLogLine(line: string) {
  return !line.includes('自分手札')
    && !line.includes('相手予定')
    && !isSelectionLogLine(line);
}

export function examBattleLogTurnTitle(line: string) {
  if (line.startsWith('開始')) return '開始';
  const turnMatch = line.match(/^(\d+)T/);
  if (turnMatch) return `${turnMatch[1]}T`;
  if (line.startsWith('結果')) return '結果';
  if (line.startsWith('スコア内訳')) return 'スコア';
  if (line.startsWith('リタイア')) return 'リタイア';
  return 'その他';
}

function buildExamBattleLogEntry(line: string, options: BattleLogParserOptions): BattleLogEntry {
  const displayLine = formatBattleLogLine(line);
  const emphasized = isHighlightedLogLine(line);
  if (isSystemLogLine(line)) return { line, displayLine, side: 'system', emphasized };
  if (line.includes('相手効果') || line.includes(' 相手 ')) {
    const label = enemyLogLabel(displayLine);
    return {
      line,
      displayLine: stripEnemyLogLabel(displayLine),
      side: 'enemy',
      emphasized,
      label,
      targetIcon: options.playerIcon?.(line.split('->')[1] || ''),
      targetLabel: enemyLogTargetLabel(line, label),
      sourceElement: enemyLogSourceElement(line),
      targetElement: enemyLogTargetElement(line),
    };
  }
  if (line.includes(' 自分 ') || line.includes('自分効果') || line.includes('自分回復') || line.includes('継続回復')) {
    return {
      line,
      displayLine,
      side: 'player',
      emphasized,
      icon: options.playerIcon?.(line) || '',
      targetLabel: playerLogTargetLabel(line),
      sourceElement: playerLogSourceElement(line),
      targetElement: playerLogTargetElement(line),
    };
  }
  return { line, displayLine, side: 'system' };
}

function isHighlightedLogLine(line: string) {
  if (line.startsWith('スコア内訳')) return false;
  return line.includes('回避') || line.includes('クリティカル') || line.includes('暗闇');
}

function formatBattleLogLine(line: string) {
  let text = line.replace(/^\d+T\s+/, '');
  text = text.replace(/^(先手|後手)\s+/, '');
  text = text.replace(/^相手効果\s+/, '');
  text = text.replace(/^自分効果\s+/, '効果 ');
  text = text.replace(/^自分回復\s+/, '回復 ');
  text = text.replace(/^自分\s+/, '');
  text = text.replace(/^相手\s+/, '');
  text = stripPlayerCardNames(text);
  text = stripInlineEnemyLabels(text);
  text = stripInlineElementTexts(text);
  text = stripArrowTargetLabels(text);
  text = stripInlineElementTexts(text);
  text = stripLogCalculationDetails(text);
  if (!isSelectionLogLine(line)) text = stripInlineTargetMagic(text);
  text = text.replace(/\s*->\s*/g, ' / ');
  text = text.replace(/\s+\/\s+\/\s+/g, ' / ');
  return text.trim();
}

function enemyLogLabel(displayLine: string) {
  const match = displayLine.match(/^([^:：\s/]+)[:：]/);
  return match?.[1] || '敵';
}

function stripEnemyLogLabel(displayLine: string) {
  return displayLine.replace(/^[^:：\s/]+[:：]\s*/, '');
}

function stripPlayerCardNames(text: string) {
  return text.replace(/[^/\s]+\/[^\s]+\s+(M[123]\()/g, '$1');
}

function stripInlineElementTexts(text: string) {
  return text
    .replace(/(M[123]\()([火水木無]),\s*/g, '$1')
    .replace(/(\S+\()([火水木無]),\s*/g, '$1')
    .replace(/\s*受け[火水木無]\s*/g, ' ')
    .replace(/->\s*[火水木無]\s*\/\s*/g, '-> ')
    .replace(/->\s*[火水木無]\s+(与[\d,]+)/g, '-> $1')
    .replace(/\s\/\s[火水木無]\s+(与[\d,]+)/g, ' / $1');
}

function stripLogCalculationDetails(text: string) {
  return text
    .replace(/,\s*等倍[\d,]+/g, '')
    .replace(/,\s*ATK[\d,]+/g, '')
    .replace(/\s+ATK[\d,]+/g, '')
    .replace(/\s*\/\s*逆算ATK[\d,]+/g, '')
    .replace(/\s*\/\s*等倍[\d,]+/g, '')
    .replace(/\s*\/\s*ATK[\d,]+/g, '')
    .replace(/\s*\[[\d,+]+\]/g, '')
    .replace(/\s+受け\s+(被[\d,]+)/g, ' $1')
    .replace(/\s+受け(?=\s|\/|$)/g, '');
}

function stripInlineEnemyLabels(text: string) {
  return text.replace(/(先手|後手)\s+([^:：\s/]+)[:：]\s*/g, '$1 ');
}

function stripArrowTargetLabels(text: string) {
  return text
    .replace(/->\s*相手全体\s*\/\s*/g, '-> ')
    .replace(/->\s*([^:：\s/]+)[:：]\s*/g, '-> ');
}

function stripInlineTargetMagic(text: string) {
  return text.replace(/->\s*M[123]\((?:[^()]|\([^()]*\))*\)\s*/g, '-> ');
}

function enemyLogSourceElement(line: string): BattleLogActionElement | undefined {
  return extractActionElement(line);
}

function enemyLogTargetElement(line: string): BattleLogActionElement | undefined {
  const targetText = line.split('->')[1] || '';
  return extractMagicElement(targetText) || extractReceivingElement(targetText);
}

function enemyLogTargetLabel(line: string, sourceLabel: string) {
  const targetText = line.split('->')[1] || '';
  const match = targetText.match(/^\s*([^:：\s/]+)[:：]/);
  const targetLabel = match?.[1] || '';
  if (!targetLabel || targetLabel === sourceLabel) return '';
  return targetLabel;
}

function playerLogTargetLabel(line: string) {
  if ((!line.includes(' 自分 ') && !line.includes('自分効果')) || line.includes('自分回復')) return '';
  const match = line.match(/\s->\s*([^:：\s/]+)(?:[:：]|\s*\/)/);
  return match?.[1] || '敵';
}

function playerLogSourceElement(line: string): BattleLogActionElement | undefined {
  return extractMagicElement(line);
}

function playerLogTargetElement(line: string): BattleLogActionElement | undefined {
  if ((!line.includes(' 自分 ') && !line.includes('自分効果')) || line.includes('自分回復')) return undefined;
  const targetText = line.split('->')[1] || '';
  return extractTargetLabelElement(targetText) || extractReceivingElement(targetText);
}

function extractMagicElement(text: string): BattleLogActionElement | undefined {
  return normalizeActionElement(text.match(/M[123]\(([火水木無]),/)?.[1]);
}

function extractActionElement(text: string): BattleLogActionElement | undefined {
  return normalizeActionElement(text.match(/[^:：\s/]+[:：][^(]*\(([火水木無]),/)?.[1]);
}

function extractTargetLabelElement(text: string): BattleLogActionElement | undefined {
  return normalizeActionElement(text.match(/^\s*[^:：\s/]+[:：]\s*([火水木無])/)?.[1]);
}

function extractReceivingElement(text: string): BattleLogActionElement | undefined {
  return normalizeActionElement(text.match(/受け([火水木無])/)?.[1]);
}

function normalizeActionElement(value?: string): BattleLogActionElement | undefined {
  return ['火', '水', '木', '無'].includes(value || '') ? value as BattleLogActionElement : undefined;
}

function isSystemLogLine(line: string) {
  return line.startsWith('開始') || line.startsWith('結果') || line.startsWith('リタイア')
    || line.includes('自分手札') || line.includes('相手予定') || isSelectionLogLine(line)
    || line.includes('終了:') || line.includes('手札再配布') || line.includes('許容組み合わせなし')
    || line.includes('やけど:');
}

function isSelectionLogLine(line: string) {
  return /^\d+T\s+選択\s/.test(line);
}
