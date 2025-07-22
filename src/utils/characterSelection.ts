// キャラクター選択の共通ロジック

// バフの強さを判定するヘルパー関数
export const getPowerOption = (buffString: string) => {
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
};

// キャラクター画像の動的読み込み
export const loadCharacterImage = async (characterName: string) => {
  try {
    const imageModule = await import(`@/assets/img/${characterName}.png`);
    return imageModule.default;
  } catch (error) {
    try {
      const defaultModule = await import(`@/assets/img/notyet.png`);
      return defaultModule.default;
    } catch {
      return '';
    }
  }
};

// キャラクター選択時の共通処理
export const processCharacterSelection = async (chara: any, customLevel?: number) => {
  const { useHandCollectionStore } = await import('@/store/handCollection');
  const handCollectionStore = useHandCollectionStore();
  
  const levelDict: { [key: string]: number } = {'R': 70, 'SR': 90, 'SSR': 110};
  
  // 手持ちコレクション設定を確認
  let characterLevel = customLevel || levelDict[chara.rare];
  let hasM3 = chara.rare === 'SSR';
  let bonusSelected = true;
  
  if (handCollectionStore.useHandCollection) {
    const handCard = handCollectionStore.getHandCard(chara.name);
    if (handCard.isOwned) {
      characterLevel = Number(handCard.level);
      hasM3 = handCard.isM3;
      bonusSelected = handCard.isLimitBreak;
    } else {
      characterLevel = 1;
      hasM3 = false;
      bonusSelected = false;
    }
  }
  
  // 初期設定の処理
  const initialSettings = {
    chara: chara.chara || '',
    level: characterLevel,
    hp: chara.hp || 0,
    atk: chara.atk || 0,
    isM1Selected: true,
    isM2Selected: true,
    isM3Selected: false,
    isBonusSelected: bonusSelected,
    magic1Lv: chara.magic1Lv || 10,
    magic2Lv: chara.magic2Lv || 10,
    magic3Lv: chara.magic3Lv || 10,
    buddy1c: chara.buddy1c || '',
    buddy2c: chara.buddy2c || '',
    buddy3c: chara.buddy3c || '',
    buddy1s: chara.buddy1s || '',
    buddy2s: chara.buddy2s || '',
    buddy3s: chara.buddy3s || '',
    buddy1Lv: chara.buddy1Lv || 10,
    buddy2Lv: chara.buddy2Lv || 10,
    buddy3Lv: chara.buddy3Lv || 10,
    buffs: [] as any[]
  };

  // 各魔法の初期設定をループで処理
  for (let magicIndex = 1; magicIndex <= 3; magicIndex++) {
    const magicKey = `magic${magicIndex}`;
    // バフと回復の設定
    chara[`${magicKey}buf`] = chara[`${magicKey}buf`] || '';
    chara[`${magicKey}heal`] = chara[`${magicKey}heal`] || '';
    // マジックの属性と威力の設定
    chara[`${magicKey}Attribute`] = chara[`${magicKey}atr`] || '';
    chara[`${magicKey}Power`] = chara[`${magicKey}pow`] || '単発(弱)';

    // バフと回復の自動設定
    const buffValue = chara[`${magicKey}buf`];
    const healValue = chara[`${magicKey}heal`];
    
    // バフの追加
    if (buffValue) {
      const buffType = buffValue.includes('ATKUP') ? 'ATKUP' :
                      buffValue.includes('属性ダメUP') ? '属性ダメUP' :
                      buffValue.includes('ダメUP') ? 'ダメージUP' :
                      buffValue.includes('クリティカル') ? 'クリティカル' : '';
      
      if (buffType) {
        const buff = {
          magicOption: `M${magicIndex}`,
          buffOption: buffType,
          powerOption: getPowerOption(buffValue),
          levelOption: buffType === 'クリティカル' ? 1 : 10
        };
        initialSettings.buffs.push(buff);
      }
    }
    
    // etcフィールドから被ダメージUPの相手対象をチェック
    if (chara.etc) {
      const etcEffects = chara.etc.split(',').map((effect: string) => effect.trim());
      const magicEffects = etcEffects.filter((effect: string) => effect.includes(`(M${magicIndex})`));
      
      for (const effect of magicEffects) {
        if (effect.includes('被ダメージUP') && effect.includes('相手')) {
          const buff = {
            magicOption: `M${magicIndex}`,
            buffOption: 'ダメージUP',
            powerOption: getPowerOption(effect),
            levelOption: 10
          };
          initialSettings.buffs.push(buff);
          break;
        }
      }
    }
    
    // 回復の追加
    if (healValue) {
      if (healValue.includes('回復&継続回復')) {
        initialSettings.buffs.push({
          magicOption: `M${magicIndex}`,
          buffOption: '継続回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
        initialSettings.buffs.push({
          magicOption: `M${magicIndex}`,
          buffOption: '回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
      } else if (healValue.includes('継続回復')) {
        initialSettings.buffs.push({
          magicOption: `M${magicIndex}`,
          buffOption: '継続回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
      } else if (healValue.includes('回復')) {
        initialSettings.buffs.push({
          magicOption: `M${magicIndex}`,
          buffOption: '回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
      }
    }
  }
  
  // 初期設定を適用
  Object.assign(chara, initialSettings);
  
  // 画像を動的に読み込む
  chara.imgUrl = await loadCharacterImage(chara.name);
  
  return chara;
};