// etc文字列からバフ情報を抽出して、シミュレータ互換のbuffs[]形式に正規化するユーティリティ

export type ParsedBuff = {
  magicOption: 'M1' | 'M2' | 'M3';
  buffOption:
    | 'ATKUP'
    | 'ATKDOWN'
    | 'ダメージUP'
    | 'ダメージDOWN'
    | '属性ダメUP'
    | '属性ダメDOWN'
    | '被ダメージUP'
    | '属性被ダメージUP'
    | '被ダメージDOWN'
    | '属性被ダメージDOWN'
    | 'クリティカル'
    | '回避'
    | '暗闇'
    | '凍結'
    | '呪い'
    | '回復'
    | '継続回復'
    | 'デバフ解除'
    | 'バフ解除'
    | 'ガッツ'
    | '暗闇無効'
    | '呪い無効'
    | '凍結無効'
    | 'やけど無効';
  powerOption: string; // '極小' | '小' | '中' | '大' | '極大' | '1/1' | '1/2' | '1/3' | '2/3'
  levelOption: number;
  attributeOption?: '火' | '水' | '木' | '無';
  // 追加情報（任意）
  durationTurns?: number; // 効果ターン（例: 自/3T -> 3）
  isSelf?: boolean; // 自対象か
  targetType?: 'self' | 'allySelected' | 'allyAll' | 'opponent' | 'opponentSelected' | 'opponentAll';
};

// パワー文字列抽出（characterSelection.tsの実装と同等の挙動）
function getPowerOption(buffString: string): string {
  if (buffString.includes('(0)')) return '0';
  if (buffString.includes('(1/1)')) return '1/1';
  if (buffString.includes('(1/2)')) return '1/2';
  if (buffString.includes('(1/3)')) return '1/3';
  if (buffString.includes('(2/3)')) return '2/3';

  if (buffString.includes('クリティカル')) {
    if (buffString.includes('(極小)')) return '極小';
    if (buffString.includes('(小)')) return '小';
    if (buffString.includes('(中)')) return '中';
    if (buffString.includes('(大)')) return '大';
    if (buffString.includes('(極大)')) return '極大';
    return '中';
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

export function isPlayerSideBuffTarget(buff: Pick<ParsedBuff, 'targetType' | 'isSelf'>): boolean {
  const targetType = buff.targetType ?? 'self';
  return targetType === 'self' || targetType === 'allySelected' || targetType === 'allyAll';
}

export function isOpponentSideBuffTarget(buff: Pick<ParsedBuff, 'targetType' | 'isSelf'>): boolean {
  const targetType = buff.targetType ?? 'self';
  return targetType === 'opponent' || targetType === 'opponentSelected' || targetType === 'opponentAll';
}

export function normalizeLegacyDeckBuff(buff: ParsedBuff): ParsedBuff | null {
  if (isPlayerSideBuffTarget(buff)) {
    if (buff.buffOption === 'クリティカル') {
      const legacyCriticalPowerMap: Record<string, string> = {
        極小: '1/1',
        小: '1/2',
        中: '1/2',
        大: '2/3',
        極大: '1/1',
      };
      const normalizedPowerOption = legacyCriticalPowerMap[buff.powerOption] ?? buff.powerOption;
      if (normalizedPowerOption === buff.powerOption) {
        return buff;
      }
      return {
        ...buff,
        powerOption: normalizedPowerOption,
      };
    }

    if ([
      'ATKUP',
      'ATKDOWN',
      'ダメージUP',
      'ダメージDOWN',
      '属性ダメUP',
      '属性ダメDOWN',
      '回復',
      '継続回復',
    ].includes(buff.buffOption)) {
      return buff;
    }
    return null;
  }

  if (buff.buffOption === '被ダメージUP') {
    return {
      ...buff,
      buffOption: 'ダメージUP',
      isSelf: true,
      targetType: 'self',
    };
  }

  if (buff.buffOption === '属性被ダメージUP') {
    return {
      ...buff,
      buffOption: '属性ダメUP',
      isSelf: true,
      targetType: 'self',
    };
  }

  return null;
}

export function normalizeLegacyDeckBuffs(buffs: ParsedBuff[]): ParsedBuff[] {
  return buffs
    .map(normalizeLegacyDeckBuff)
    .filter((buff): buff is ParsedBuff => buff !== null);
}


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
    const targetType: ParsedBuff['targetType'] = item.includes('味方全体')
      ? 'allyAll'
      : item.includes('味方選択')
        ? 'allySelected'
        : item.includes('相手全体')
          ? 'opponentAll'
          : item.includes('相手選択')
            ? 'opponentSelected'
            : item.includes('相手')
              ? 'opponent'
              : 'self';
    // 効果ターン数（自/XT, 相手/XT, 相手全体/XT など）
    let durationTurns: number | undefined = undefined;
    const durMatch = item.match(/(?:自|相手(?:全体|選択)?|味方(?:全体|選択)?)\/(\d+)T/);
    if (durMatch) {
      const n = Number(durMatch[1]);
      if (!Number.isNaN(n)) durationTurns = n;
    }

    // 種別判定
    let buffType: ParsedBuff['buffOption'] | '' = '';

    if (item.includes('HP継続回復') || item.includes('継続回復')) buffType = '継続回復';
    else if (item.includes('HP回復')) buffType = '回復';
    else if (item.includes('デバフ解除')) buffType = 'デバフ解除';
    else if (item.includes('バフ解除')) buffType = 'バフ解除';
    else if (item.includes('暗闇無効')) buffType = '暗闇無効';
    else if (item.includes('呪い無効')) buffType = '呪い無効';
    else if (item.includes('凍結無効')) buffType = '凍結無効';
    else if (item.includes('やけど無効')) buffType = 'やけど無効';
    else if (item.includes('属性被ダメージDOWN')) buffType = '属性被ダメージDOWN';
    else if (item.includes('属性被ダメージUP')) buffType = '属性被ダメージUP';
    else if (item.includes('被ダメージDOWN')) buffType = '被ダメージDOWN';
    else if (item.includes('被ダメージUP')) buffType = '被ダメージUP';
    else if (item.includes('属性ダメージDOWN')) buffType = '属性ダメDOWN';
    else if (item.includes('属性ダメージUP')) buffType = '属性ダメUP';
    else if (item.includes('ATKDOWN')) buffType = 'ATKDOWN';
    else if (item.includes('ATKUP')) buffType = 'ATKUP';
    else if (item.includes('ダメージDOWN')) buffType = 'ダメージDOWN';
    else if (item.includes('ダメージUP')) buffType = 'ダメージUP';
    else if (item.includes('クリティカル')) buffType = 'クリティカル';
    else if (item.includes('回避')) buffType = '回避';
    else if (item.includes('暗闇')) buffType = '暗闇';
    else if (item.includes('凍結')) buffType = '凍結';
    else if (item.includes('呪い')) buffType = '呪い';
    else if (item.includes('ガッツ')) buffType = 'ガッツ';

    if (!buffType) continue;

    const power = getPowerOption(item);
    const level = 10;
    const attributeMatch = item.match(/^(火|水|木|無)属性(?:ダメージ(?:UP|DOWN)|被ダメージ(?:UP|DOWN))/);

    results.push({
      magicOption,
      buffOption: buffType,
      powerOption: power,
      levelOption: level,
      attributeOption: attributeMatch ? (attributeMatch[1] as ParsedBuff['attributeOption']) : undefined,
      durationTurns,
      isSelf,
      targetType,
    });
  }

  return results;
}
