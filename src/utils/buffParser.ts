// etc文字列からバフ情報を抽出して、シミュレータ互換のbuffs[]形式に正規化するユーティリティ

export type ParsedBuff = {
  magicOption: 'M1' | 'M2' | 'M3';
  buffOption: 'ATKUP' | 'ダメージUP' | '属性ダメUP' | 'クリティカル';
  powerOption: string; // '極小' | '小' | '中' | '大' | '極大' | '1/1' | '1/2' | '1/3' | '2/3'
  levelOption: number;
  // 追加情報（任意）
  durationTurns?: number; // 効果ターン（例: 自/3T -> 3）
  isSelf?: boolean; // 自対象か
};

// パワー文字列抽出（characterSelection.tsの実装と同等の挙動）
function getPowerOption(buffString: string): string {
  if (buffString.includes('(0)')) return '0';
  if (buffString.includes('(1/1)')) return '1/1';
  if (buffString.includes('(1/2)')) return '1/2';
  if (buffString.includes('(1/3)')) return '1/3';
  if (buffString.includes('(2/3)')) return '2/3';

  if (buffString.includes('クリティカル')) {
    if (buffString.includes('(小)')) return '1/2';
    if (buffString.includes('(中)')) return '1/1';
    if (buffString.includes('(大)')) return '2/3';
    if (buffString.includes('(極大)')) return '1/1';
    return '1/1';
  }

  if (buffString.includes('(極小)')) return '極小';
  if (buffString.includes('(小)')) return '小';
  if (buffString.includes('(中)')) return '中';
  if (buffString.includes('(大)')) return '大';
  if (buffString.includes('(極大)')) return '極大';
  return '中';
}

export type ParseOptions = {
  allowM3?: boolean; // SSRかつM3所持のときtrue、それ以外はfalse
};

// etcから(M1)/(M2)/(M3)付きの自己/相手効果を抽出
export function parseMagicBuffsFromEtc(chara: any, opts: ParseOptions = {}): ParsedBuff[] {
  const etcRaw: string = (chara?.etc || '').toString();
  if (!etcRaw) return [];

  const allowM3 = opts.allowM3 !== undefined ? !!opts.allowM3 : true;

  // 改行 <br> とカンマ区切りの両方に対応
  const normalized = etcRaw.replace(/<br\s*\/?>/g, ',');
  const items = normalized.split(',').map(s => s.trim()).filter(Boolean);

  const results: ParsedBuff[] = [];

  for (const item of items) {
    // M番号の抽出
    const mMatch = item.match(/\(M(\d)\)/);
    if (!mMatch) continue;
    const mIdx = Number(mMatch[1]);
    if (mIdx === 3 && !allowM3) continue;
    const magicOption = (`M${mIdx}`) as ParsedBuff['magicOption'];

    const isSelf = /(自\s*\/|自\))/.test(item) || item.includes('自/');
    const isOpponent = item.includes('相手');
    const isAlly = item.includes('味方');
    // 効果ターン数（自/XT, 相手/XT, 相手全体/XT など）
    let durationTurns: number | undefined = undefined;
    const durMatch = item.match(/(?:自|相手(?:全体)?)\/(\d+)T/);
    if (durMatch) {
      const n = Number(durMatch[1]);
      if (!Number.isNaN(n)) durationTurns = n;
    }

    // 種別判定
    let buffType: ParsedBuff['buffOption'] | '' = '';

    if (item.includes('被ダメージUP') && isOpponent) {
      // 相手に被ダメUP → 自分のダメージUPとして扱う
      buffType = 'ダメージUP';
    } else if (isSelf || isAlly) {
      if (item.includes('ATKUP')) buffType = 'ATKUP';
      else if (item.includes('被ダメージUP')) buffType = '';
      else if (item.includes('属性ダメージUP')) buffType = '属性ダメUP';
      else if (item.includes('ダメージUP')) buffType = 'ダメージUP';
      else if (item.includes('クリティカル')) buffType = 'クリティカル';
    }

    if (!buffType) continue;

    const power = getPowerOption(item);
    const level = 10;

    results.push({
      magicOption,
      buffOption: buffType,
      powerOption: power,
      levelOption: level,
      durationTurns,
      isSelf,
    });
  }

  return results;
}
