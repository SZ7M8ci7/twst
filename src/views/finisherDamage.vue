<template>
  <v-container class="finisher-container">
    <!-- ローディング表示 -->
    <div v-if="loading" class="loading-container">
      <v-progress-circular
        indeterminate
        color="primary"
        :size="64"
      ></v-progress-circular>
      <p class="loading-text">Loading...</p>
    </div>

    <!-- メインコンテンツ -->
    <template v-else>
      <!-- 属性表示を1行目に追加 -->
      <div class="character-row">
        <div class="character-item" :style="{ ...iconStyle }">
          <!-- 手持ち設定トグル（クリック切り替え） -->
          <div 
            class="toggle-button" 
            @click="toggleHandCollection"
            :class="{ 'active': useHandCollection }"
          >
            {{ useHandCollection ? t('finisherDamage.handCollection') : t('finisherDamage.allCards') }}
          </div>
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item clickable-header" @click="toggleSort(element.toLowerCase())">
              <div class="header-content">
                <span class="vs-text">VS</span>
                <img
                  :src="characterInfoMap.get(element.toLowerCase())?.imgSrc || ''"
                  :alt="element"
                  class="element-icon"
                />
                <span class="sort-icon">
                  <span v-if="sortColumn === element.toLowerCase()" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                  <span v-else class="sort-hint">↕</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ALL行を最上部に固定表示 -->
      <div class="character-row all-characters-row">
        <div class="character-item" :style="{ ...iconStyle }">
          <div class="all-characters-label">ALL</div>
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item all-characters-item">
              <span
                class="clickable-damage"
                @click="openAllCharactersModal(element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic')"
              >
                {{ getMaxDamage('全キャラ', element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic') }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        v-for="character in sortedCharacterData"
        :key="character.name_en"
        class="character-row"
      >
        <div class="character-item" :style="{ ...iconStyle }">
          <CharacterIconWithType 
            :iconKey="character.name_ja" 
            :iconDictionary="iconsForCharacterIconWithType"
            :wikiUrl="characterInfoMap.get(character.name_ja)?.wikiUrl || ''" 
            :iconSize="iconSize" 
            />
        </div>
        <div class="damage-row">
          <div
            v-for="element in ['Fire', 'Water', 'Flora', 'Cosmic']"
            :key="element"
            class="damage-col"
          >
            <div class="damage-item">
              <span
                class="clickable-damage"
                @click="openDamageModal(character.name_ja, element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic')"
              >
                {{ getMaxDamage(character.name_ja, element.toLowerCase() as 'fire' | 'water' | 'flora' | 'cosmic') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- モーダル -->
    <v-dialog v-model="dialogVisible" max-width="450">
      <v-card>
        <v-card-text class="modal-content">
          <v-list class="damage-list">
            <v-list-item
              v-for="(entry, index) in paginatedDamageList"
              :key="index"
              class="damage-list-item"
            >
              <div class="damage-item-content">
                <div class="card-info">
                  <CharacterIconWithType
                    :iconKey="entry.cardName || ''"
                    :iconDictionary="iconsForCharacterIconWithType"
                    :wikiUrl="characterInfoMap.get(entry.cardName || '')?.wikiUrl || ''"
                    :cardType="characterInfoMap.get(entry.cardName || '')?.type || ''"
                    :iconSize="46"
                    class="card-icon clickable-icon"
                    @click="openWikiPage(entry.cardName)"
                  />
                  <div class="buddy-cards" v-if="entry.cardName">
                    <CharacterIconWithType
                      v-for="buddyCardNameJa in getBuddyCards(entry.cardName)"
                      :key="buddyCardNameJa"
                      :iconKey="buddyCardNameJa"
                      :iconDictionary="iconsForCharacterIconWithType"
                      :wikiUrl="characterInfoMap.get(buddyCardNameJa)?.wikiUrl || ''"
                      :cardType="characterInfoMap.get(buddyCardNameJa)?.type || ''"
                      :iconSize="26"
                      class="buddy-icon clickable-icon"
                      @click="openWikiPage(buddyCardNameJa)"
                    />
                  </div>
                </div>
                <div class="buff-info" v-if="entry.name">
                  <div class="buff-container">
                    <CharacterIconWithType
                      :iconKey="entry.name"
                      :iconDictionary="iconsForCharacterIconWithType"
                      :wikiUrl="characterInfoMap.get(entry.name)?.wikiUrl || ''"
                      :cardType="characterInfoMap.get(entry.name)?.type || ''"
                      :iconSize="46"
                      class="buff-icon clickable-icon"
                      @click="openWikiPage(entry.name)"
                    />
                    <span class="buff-source" v-if="entry.buffSource">{{ entry.buffSource }}</span>
                  </div>
                </div>
                <div class="damage-value">
                  <div class="damage-value-actions">
                    <span>{{ Math.floor(entry.damage * criticalMultipliers[criticalLevel]).toLocaleString() }}</span>
                    <v-menu
                      location="bottom end"
                      content-class="deck-search-menu-overlay"
                    >
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          variant="text"
                          size="x-small"
                          icon="mdi-magnify"
                          class="deck-search-button"
                        />
                      </template>
                      <v-list density="compact" class="deck-search-menu-list">
                        <div class="deck-search-menu-description">
                          {{ t('finisherDamage.deckSearchDescription') }}
                        </div>
                        <div class="deck-search-table">
                          <div class="deck-search-table-header">
                            <span>{{ t('finisherDamage.finisherLabel') }}</span>
                            <span>{{ t('finisherDamage.bufferLabel') }}</span>
                            <span class="deck-search-table-icon-header">
                              <v-icon size="16">mdi-magnify</v-icon>
                            </span>
                          </div>
                          <button
                            v-for="option in deckSearchOptions"
                            :key="option.key"
                            type="button"
                            class="deck-search-table-row"
                            :disabled="isDeckSearchOptionDisabled(
                              {
                                finisherCardName: entry.cardName || '',
                                bufferName: entry.name,
                                bufferSource: entry.buffSource || ''
                              },
                              option
                            )"
                            @click="openDeckSearchFromDamageEntry(
                              {
                                finisherCardName: entry.cardName || '',
                                bufferName: entry.name,
                                bufferSource: entry.buffSource || ''
                              },
                              selectedElement,
                              option
                            )"
                          >
                            <span>{{ getPlacementLabel(option.finisherPlacement) }}</span>
                            <span>{{ getPlacementLabel(option.bufferPlacement) }}</span>
                            <span class="deck-search-table-open">
                              <v-icon size="16">mdi-magnify</v-icon>
                            </span>
                          </button>
                        </div>
                      </v-list>
                    </v-menu>
                  </div>
                </div>
              </div>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <div class="pagination-controls">
            <v-btn
              :disabled="currentPage === 1"
              @click="currentPage--"
              variant="text"
              size="small"
              icon
            >
              <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <v-btn
              :disabled="currentPage === totalPages"
              @click="currentPage++"
              variant="text"
              size="small"
              icon
            >
              <v-icon>mdi-chevron-right</v-icon>
            </v-btn>
          </div>
          <v-spacer />
          <v-btn 
            variant="outlined" 
            class="critical-btn" 
            :style="getCriticalButtonStyle(criticalLevel)"
            @click="toggleCritical"
          >
            {{ getCriticalButtonText(criticalLevel) }}
          </v-btn>
          <v-btn color="grey" variant="outlined" class="close-btn" @click="dialogVisible = false">CLOSE</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 全キャラクター情報モーダル -->
    <v-dialog v-model="allCharactersDialogVisible" max-width="450">
      <v-card>
        <v-card-text class="modal-content">
          <v-list class="damage-list">
            <v-list-item
              v-for="(entry, index) in paginatedAllCharactersDamageList"
              :key="index"
              class="damage-list-item"
            >
              <div class="damage-item-content">
                <div class="card-info">
                  <CharacterIconWithType
                    :iconKey="entry.cardName"
                    :iconDictionary="iconsForCharacterIconWithType"
                    :wikiUrl="characterInfoMap.get(entry.cardName)?.wikiUrl || ''"
                    :cardType="characterInfoMap.get(entry.cardName)?.type || ''"
                    :iconSize="46"
                    class="card-icon clickable-icon"
                    @click="openWikiPage(entry.cardName)"
                  />
                  <div class="buddy-cards" v-if="entry.cardName">
                    <CharacterIconWithType
                      v-for="buddyCardNameJa in getBuddyCards(entry.cardName)"
                      :key="buddyCardNameJa"
                      :iconKey="buddyCardNameJa"
                      :iconDictionary="iconsForCharacterIconWithType"
                      :wikiUrl="characterInfoMap.get(buddyCardNameJa)?.wikiUrl || ''"
                      :cardType="characterInfoMap.get(buddyCardNameJa)?.type || ''"
                      :iconSize="26"
                      class="buddy-icon clickable-icon"
                      @click="openWikiPage(buddyCardNameJa)"
                    />
                  </div>
                </div>
                <div class="buff-info" v-if="entry.buffName">
                  <div class="buff-container">
                    <CharacterIconWithType
                      :iconKey="entry.buffName"
                      :iconDictionary="iconsForCharacterIconWithType"
                      :wikiUrl="characterInfoMap.get(entry.buffName)?.wikiUrl || ''"
                      :cardType="characterInfoMap.get(entry.buffName)?.type || ''"
                      :iconSize="46"
                      class="buff-icon clickable-icon"
                      @click="openWikiPage(entry.buffName)"
                    />
                    <span class="buff-source" v-if="entry.buffSource">{{ entry.buffSource }}</span>
                  </div>
                </div>
                <div class="damage-value">
                  <div class="damage-value-actions">
                    <span>{{ Math.floor(entry.damage * criticalMultipliers[allCharactersCriticalLevel]).toLocaleString() }}</span>
                    <v-menu
                      location="bottom end"
                      content-class="deck-search-menu-overlay"
                    >
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          variant="text"
                          size="x-small"
                          icon="mdi-magnify"
                          class="deck-search-button"
                        />
                      </template>
                      <v-list density="compact" class="deck-search-menu-list">
                        <div class="deck-search-menu-description">
                          {{ t('finisherDamage.deckSearchDescription') }}
                        </div>
                        <div class="deck-search-table">
                          <div class="deck-search-table-header">
                            <span>{{ t('finisherDamage.finisherLabel') }}</span>
                            <span>{{ t('finisherDamage.bufferLabel') }}</span>
                            <span class="deck-search-table-icon-header">
                              <v-icon size="16">mdi-magnify</v-icon>
                            </span>
                          </div>
                          <button
                            v-for="option in deckSearchOptions"
                            :key="option.key"
                            type="button"
                            class="deck-search-table-row"
                            :disabled="isDeckSearchOptionDisabled(
                              {
                                finisherCardName: entry.cardName,
                                bufferName: entry.buffName,
                                bufferSource: entry.buffSource || ''
                              },
                              option
                            )"
                            @click="openDeckSearchFromDamageEntry(
                              {
                                finisherCardName: entry.cardName,
                                bufferName: entry.buffName,
                                bufferSource: entry.buffSource || ''
                              },
                              selectedAllCharactersElement,
                              option
                            )"
                          >
                            <span>{{ getPlacementLabel(option.finisherPlacement) }}</span>
                            <span>{{ getPlacementLabel(option.bufferPlacement) }}</span>
                            <span class="deck-search-table-open">
                              <v-icon size="16">mdi-magnify</v-icon>
                            </span>
                          </button>
                        </div>
                      </v-list>
                    </v-menu>
                  </div>
                </div>
              </div>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <div class="pagination-controls">
            <v-btn
              :disabled="allCharactersCurrentPage === 1"
              @click="allCharactersCurrentPage--"
              variant="text"
              size="small"
              icon
            >
              <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
            <span class="page-info">{{ allCharactersCurrentPage }} / {{ allCharactersTotalPages }}</span>
            <v-btn
              :disabled="allCharactersCurrentPage === allCharactersTotalPages"
              @click="allCharactersCurrentPage++"
              variant="text"
              size="small"
              icon
            >
              <v-icon>mdi-chevron-right</v-icon>
            </v-btn>
          </div>
          <v-spacer />
          <v-btn 
            variant="outlined" 
            class="critical-btn" 
            :style="getCriticalButtonStyle(allCharactersCriticalLevel)"
            @click="toggleAllCharactersCritical"
          >
            {{ getCriticalButtonText(allCharactersCriticalLevel) }}
          </v-btn>
          <v-btn color="grey" variant="outlined" class="close-btn" @click="allCharactersDialogVisible = false">CLOSE</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import { useSearchSettingsStore, createDefaultSearchSettingsState } from '@/store/searchSetting';
import { storeToRefs } from 'pinia';
import { loadImageUrls, createCharacterInfoMap, CharacterCardInfo } from '@/components/common';
import CharacterIconWithType from '@/components/CharacterIconWithType.vue';
import { onMounted, ref, Ref, computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { recalculateATK } from '@/utils/calculations';
import { SEARCH_PRESET_CONFIGURATIONS } from '@/constants/searchPresets';
import characterDataJson from '@/assets/characters_info.json';
const { t } = useI18n();
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const searchSettingsStore = useSearchSettingsStore();
const router = useRouter();
const { characters } = storeToRefs(characterStore);
// 独自の手持ち設定状態を管理（ストアとは独立）
const useHandCollection = ref(false);

const characterInfoMap: Ref<Map<string, CharacterCardInfo>> = ref(new Map());

const iconSize = 50;
const gapSize = 10;

const iconStyle = ref({
  '--icon-size': `${iconSize}px`,
  '--gap-size': `${gapSize}px`
});

const elementIcons = {
  fire: 'fire',
  water: 'water',
  flora: 'flora',
  cosmic: 'cosmic'
};

const loading = ref(true);
const savedCharacterLevels = ref<Record<string, number>>({});

// CharacterIconWithTypeコンポーネントに渡すためのアイコン辞書
const iconsForCharacterIconWithType = computed(() => {
  const record: Record<string, string> = {};
  for (const [key, info] of characterInfoMap.value.entries()) {
    record[key] = info.iconSrc || info.imgSrc || ''; 
  }
  return record;
});

onMounted(async () => {
  loadSavedCharacterLevels();
  try {
    // 1. Piniaストアのcharactersからメイン画像URLを取得
    const mainImageUrls = await loadImageUrls(characters.value, 'name');

    // 2. characterDataJsonからアイコン画像URLを取得 (キーは英語名)
    const iconImageUrlsFromCharacterDataRaw = await loadImageUrls(characterDataJson, 'name_en', 'icon/');

    // 3. Piniaストアのcharactersを元に、日本語名キーのアイコン辞書を作成
    const iconImageUrlsForStoreChars: Record<string, string> = {};
    const characterNameEnMap = new Map(characterDataJson.map(cd => [cd.name_ja, cd.name_en]));

    characters.value.forEach(char => {
      const nameEn = characterNameEnMap.get(char.name); // 日本語名から英語名を取得
      if (nameEn && iconImageUrlsFromCharacterDataRaw[nameEn]) {
        iconImageUrlsForStoreChars[char.name] = iconImageUrlsFromCharacterDataRaw[nameEn];
      }
    });

    // 4. 属性アイコンの辞書を作成
    const elementIconUrls = await loadImageUrls(Object.values(elementIcons), (item) => item, 'icon/');

    // 5. まずPiniaストアのキャラクター情報でcharacterInfoMapを作成
    characterInfoMap.value = createCharacterInfoMap(
      characters.value, 
      mainImageUrls, 
      iconImageUrlsForStoreChars, 
      elementIconUrls
    );

    // 6. characterDataJson にのみ存在するキャラクターの情報、および既存キャラクターの英語名キーでの情報を characterInfoMap に追加
    const existingKeysInCharacterInfoMap = new Set(characterInfoMap.value.keys());

    characterDataJson.forEach(cd => {
      const iconUrl = iconImageUrlsFromCharacterDataRaw[cd.name_en];
      if (iconUrl) {
        // 日本語名キーでの登録 (まだ登録されていなければ)
        if (cd.name_ja && !existingKeysInCharacterInfoMap.has(cd.name_ja)) {
          characterInfoMap.value.set(cd.name_ja, {
            type: '', 
            wikiUrl: '',
            imgSrc: '', 
            iconSrc: iconUrl,
          });
        }
        // 英語名キーでの登録 (まだ登録されていなければ)
        if (cd.name_en && !existingKeysInCharacterInfoMap.has(cd.name_en)) {
          characterInfoMap.value.set(cd.name_en, {
            type: '', 
            wikiUrl: '', 
            imgSrc: '', 
            iconSrc: iconUrl, 
          });
        }
      }
    });

  } catch (error) {
    console.error("Error in onMounted finisherDamage.vue:", error);
  } finally {
    loading.value = false;
  }
});

// 型宣言
interface Effect { 
  buff: string; 
  name: string;
  buffSource: string;
}
interface DamageByCard { 
  damage: number; 
  name: string;
  cardName?: string;
  buffSource?: string;
}

const effectDict: Record<string, Effect[]> = {}; // キャラ名をキー、効果リストを値とする辞書

// バフ値関連定数
const buffValues = ['(極小)', '(小)', '(中)', '(大)', '(極大)']
const buffTypes = ['ATKUP', 'ダメージUP', '無属性ダメージUP', '火属性ダメージUP', '水属性ダメージUP', '木属性ダメージUP', '被ダメージUP']
const atkBuffDict: { [key: string]: number } = {
  'ATKUP(極小)': 0.1,
  'ATKUP(小)': 0.2,
  'ATKUP(中)': 0.35,
  'ATKUP(大)': 0.5,
  'ATKUP(極大)': 0.8,
};

// 画面表示用項目：キャラごとの最大ダメージ
const maxFireDamageByCharaDict: { [key: string]: number } = {};
const maxWaterDamageByCharaDict: { [key: string]: number } = {};
const maxFloraDamageByCharaDict: { [key: string]: number } = {};
const maxCosmicDamageByCharaDict: { [key: string]: number } = {};
// 画面表示用項目：カード毎のダメージとバフ要員リスト
const fireDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const waterDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const floraDamageListByCardDict: { [key: string]: DamageByCard[] } = {};
const cosmicDamageListByCardDict: { [key: string]: DamageByCard[] } = {};


// バフ要員の辞書を構築する関数
function buildEffectDict() {
  // 辞書をクリア
  Object.keys(effectDict).forEach(key => {
    effectDict[key] = [];
  });

  characters.value.forEach(character => {
    // 手持ち設定ONの場合、所持していないカードはバフ要員から除外
    if (useHandCollection.value) {
      const handCard = handCollectionStore.getHandCard(character.name);
      if (!handCard.isOwned) {
        return; // 所持していない場合はスキップ
      }
    }

    // etcをカンマで分割
    const etcItems = character.etc.split(',');

    // キャラ名をキーとして初期化
    if (!effectDict[character.chara]) {
      effectDict[character.chara] = [];
    }

    // 各効果をチェックし、キャラのリストに追加
    etcItems.forEach(item => {
      const trimmedItem = item.trim();
      if (!trimmedItem.includes('味方') && !(trimmedItem.includes('被ダメージUP') && trimmedItem.includes('相手'))) return;
      buffTypes.forEach(buffType => {
        // 〇属性ダメージUPとダメージUPを区別するために、バフの種別で文字列が始まっているかチェックする
        if (trimmedItem.startsWith(buffType)) {
          // 効果値毎に区別して辞書に追加
          buffValues.forEach(buffValue => {
            
            if (trimmedItem.includes(buffValue)) {
              // バフの種類を判定
              let buffbuffSource = '';
              if (trimmedItem.includes('(M1)')) buffbuffSource = 'M1';
              else if (trimmedItem.includes('(M2)')) buffbuffSource = 'M2';
              else if (trimmedItem.includes('(M3)')) buffbuffSource = 'M3';
              
              // M3バフの場合、レア度制限をチェック
              if (buffbuffSource === 'M3') {
                // レア度によるM3制限
                if ((character.rare === 'R' || character.rare === 'SR')) {
                  return; // R/SRの場合はM3バフをスキップ
                }
                // 手持ち設定でM3がfalseの場合もスキップ
                if (useHandCollection.value) {
                  const handCard = handCollectionStore.getHandCard(character.name);
                  if (handCard.isOwned && !handCard.isM3) {
                    return;
                  }
                }
              }
              
              effectDict[character.chara].push({ 
                buff: buffType + buffValue, 
                name: character.name,
                buffSource: buffbuffSource
              });
            }
          });
        }
      });
    });
  });
}

// 初期バフ辞書構築
buildEffectDict();
// カード毎のダメージ計算を関数化
function calculateDamage() {
  characters.value.forEach(character => {
    // SSR以外は計算しない
    if (character.rare != 'SSR') return;

    // 手持ち設定からカード情報を取得（新デッキシミュレータと同じロジック）
    let characterAtk: number;
    let shouldCalculate = true; // 計算を行うかどうかのフラグ
    
    if (useHandCollection.value) {
      const handCard = handCollectionStore.getHandCard(character.name);
      if (handCard.isOwned) {
        // 所持している場合、手持ち設定の値を使用
        const characterLevel = Number(handCard.level);
        const isLimitBreak = handCard.isLimitBreak;
        // 新デッキシミュレータと同じATK計算
        characterAtk = recalculateATK(character, characterLevel, isLimitBreak);
      } else {
        // 所持していない場合は計算しない（キャラごとの集計からは除外）
        shouldCalculate = false;
        characterAtk = 0;
      }
    } else {
      // 手持ち設定OFFの場合、フルステータスを使用
      const legacyAtkCharacter = character as typeof character & {
        originalMaxATK?: number | string;
        max_atk?: number | string;
      };
      characterAtk =
        Number(legacyAtkCharacter.originalMaxATK) ||
        Number(legacyAtkCharacter.max_atk) ||
        Number(character.atk) ||
        0;
    }

    // 所持していないカードは計算をスキップ
    if (!shouldCalculate) return;

    // ATKバディーボーナス値計算
    const buddyBonus = calcBuddy(character.buddy1s) + calcBuddy(character.buddy2s) + calcBuddy(character.buddy3s);
    // 自己ATK/ダメージバフ計算（etcを解析して合算）
    const selfAtkBuff = calcSelfAtkUpFromCharacter(character);
    const selfDamageBuff = calcSelfDamageUpFromCharacter(character);
    // 対各属性最大ダメージ
    let maxFireDamage = 0;
    let maxWaterDamage = 0;
    let maxFloraDamage = 0;
    let maxCosmicDamage = 0;

    // ダメージ計算関数
    function calcDamage(atr: string, partnerBuff: string, partnerName: string, buffSource: string) {
      const atkPartnerBuff = atkBuffDict[partnerBuff] || 0;
      // バフ込みのATK値
      const atk = characterAtk + characterAtk * buddyBonus + characterAtk * selfAtkBuff + characterAtk * atkPartnerBuff;
    let partnerDamageBuff = 0;
    const cosmicRatio = atr === '無' ? 1.1 : 1; // 無属性ダメージ補正
    // 味方のバフ値計算
    if (partnerBuff.includes(atr + '属性ダメージUP')) {
        if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.025;
        if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.06;
        if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.105;
        if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.15;
        if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.27;
    } else {
        if (partnerBuff.includes('ダメージUP') && !partnerBuff.includes('属性ダメージUP')) {
          if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.0225;
          if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.05;
          if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.0875;
          if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.125;
          if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.225;
      }
    }

    if (partnerBuff != '' && atkPartnerBuff == 0 && partnerDamageBuff == 0) {
      return;
    }
    // 等倍ダメージ
    const basedamage = Math.floor(atk * (cosmicRatio + selfDamageBuff + partnerDamageBuff) * 2.4);
    if (!fireDamageListByCardDict[character.name]) {
      fireDamageListByCardDict[character.name] = [];
      waterDamageListByCardDict[character.name] = [];
      floraDamageListByCardDict[character.name] = [];
      cosmicDamageListByCardDict[character.name] = [];
    }

    // 各属性でのダメージ値をキャラクターごとの最大ダメージと、カード毎のダメージ値で保存
    // 属性ごとの係数を辞書で定義
    const attributeModifiers: Record<string, { fire: number; water: number; flora: number; cosmic: number }> = {
      '無': { fire: 1, water: 1, flora: 1, cosmic: 1 },
      '火': { fire: 1, water: 0.5, flora: 1.5, cosmic: 1 },
      '水': { fire: 1.5, water: 1, flora: 0.5, cosmic: 1 },
      '木': { fire: 0.5, water: 1.5, flora: 1, cosmic: 1 },
    };

    // 属性の係数を取得
    const modifiers = attributeModifiers[atr] || { fire: 1, water: 1, flora: 1, cosmic: 1 };

    // 各属性でのダメージ値を計算し、最大ダメージとリストに保存
    maxFireDamage = Math.max(basedamage * modifiers.fire, maxFireDamage);
    maxWaterDamage = Math.max(basedamage * modifiers.water, maxWaterDamage);
    maxFloraDamage = Math.max(basedamage * modifiers.flora, maxFloraDamage);
    maxCosmicDamage = Math.max(basedamage * modifiers.cosmic, maxCosmicDamage);

    // ダメージリストを更新
    fireDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.fire, 
      name: partnerName,
      buffSource: buffSource
    });
    waterDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.water, 
      name: partnerName,
      buffSource: buffSource
    });
    floraDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.flora, 
      name: partnerName,
      buffSource: buffSource
    });
    cosmicDamageListByCardDict[character.name].push({ 
      damage: basedamage * modifiers.cosmic, 
      name: partnerName,
      buffSource: buffSource
    });
    }
    // 味方バフ無しで計算
    calcDamage(character.magic2atr, '', getEnglishName(character.duo), '');
    // calcDamage(character.magic2atr, 'ATKUP(小)', getEnglishName(character.duo), 'ATK小');
    // calcDamage(character.magic2atr, 'ATKUP(中)', getEnglishName(character.duo), 'ATK中');
    // calcDamage(character.magic2atr, 'ATKUP(大)', getEnglishName(character.duo), 'ATK大');
    // calcDamage(character.magic2atr, '火属性ダメージUP(大)', getEnglishName(character.duo), '属性大');
    // calcDamage(character.magic2atr, '水属性ダメージUP(大)', getEnglishName(character.duo), '属性大');
    // calcDamage(character.magic2atr, '木属性ダメージUP(大)', getEnglishName(character.duo), '属性大');
    // calcDamage(character.magic2atr, '無属性ダメージUP(大)', getEnglishName(character.duo), '属性大');
    // 味方バフ有りで計算
    effectDict[character.duo].forEach(duoPartner => {
      // M3バフの場合、デュオ相手のレア度制限をチェック
      if (duoPartner.buffSource === 'M3') {
        const duoCharacter = characters.value.find(c => c.name === duoPartner.name);
        if (duoCharacter && (duoCharacter.rare === 'R' || duoCharacter.rare === 'SR')) {
          return; // デュオ相手がR/SRの場合はM3バフをスキップ
        }
        // 手持ち設定でM3がfalseの場合もスキップ
        if (useHandCollection.value) {
          const handCard = handCollectionStore.getHandCard(duoPartner.name);
          if (handCard.isOwned && !handCard.isM3) {
            return;
          }
        }
      }
      
      calcDamage(character.magic2atr, duoPartner.buff, duoPartner.name, duoPartner.buffSource);
    });
    if (!maxFireDamageByCharaDict[character.chara]) {
      maxFireDamageByCharaDict[character.chara] = 0;
      maxWaterDamageByCharaDict[character.chara] = 0;
      maxFloraDamageByCharaDict[character.chara] = 0;
      maxCosmicDamageByCharaDict[character.chara] = 0;
    }
    maxFireDamageByCharaDict[character.chara] = Math.max(maxFireDamageByCharaDict[character.chara], maxFireDamage);
    maxWaterDamageByCharaDict[character.chara] = Math.max(maxWaterDamageByCharaDict[character.chara], maxWaterDamage);
    maxFloraDamageByCharaDict[character.chara] = Math.max(maxFloraDamageByCharaDict[character.chara], maxFloraDamage);
    maxCosmicDamageByCharaDict[character.chara] = Math.max(maxCosmicDamageByCharaDict[character.chara], maxCosmicDamage);
  });
}

// 初期計算を実行
calculateDamage();

// ATKバディ計算
function calcBuddy(buddy: string) {
  if (buddy.includes('ATK') && buddy.includes('小')) {
    return 0.2;
  }
  if (buddy.includes('ATK') && buddy.includes('中')) {
    return 0.35;
  }
  return 0;
}

// etcパーサを用いた自己バフ合算（magicNbufは使用しない）
import { parseMagicBuffsFromEtc } from '@/utils/buffParser';

function calcSelfAtkUpFromCharacter(character: any) {
  // M3可否を手持ち設定に合わせて判定
  let allowM3 = character.rare === 'SSR';
  if (useHandCollection.value) {
    const handCard = handCollectionStore.getHandCard(character.name);
    if (handCard.isOwned) allowM3 = handCard.isM3;
  }
  const parsed = parseMagicBuffsFromEtc(character, { allowM3 });
  // 対象: 自己ATKUP（全M合算）。ゲーム仕様上、2T以上のみ加算対象。
  const powerMap: Record<string, number> = {
    '極小': 0.1,
    '小': 0.2,
    '中': 0.35,
    '大': 0.5,
    '極大': 0.8,
  };
  let total = 0;
  parsed.forEach(b => {
    if (b.buffOption === 'ATKUP' && b.isSelf) {
      const dur = b.durationTurns ?? 0;
      if (dur >= 2) {
        total += powerMap[b.powerOption] || 0;
      }
    }
  });
  return total;
}

function calcSelfDamageUpFromCharacter(character: any) {
  let allowM3 = character.rare === 'SSR';
  if (useHandCollection.value) {
    const handCard = handCollectionStore.getHandCard(character.name);
    if (handCard.isOwned) allowM3 = handCard.isM3;
  }
  const parsed = parseMagicBuffsFromEtc(character, { allowM3 });
  const powerMap: Record<string, number> = {
    '極小': 0.02,
    '小': 0.05,
    '中': 0.0875,
    '大': 0.125,
    '極大': 0.1875,
  };
  let total = 0;
  parsed.forEach(b => {
    if (b.buffOption === 'ダメージUP' && b.isSelf) {
      const dur = b.durationTurns ?? 0;
      if (dur >= 2) {
        total += powerMap[b.powerOption] || 0;
      }
    }
  });
  // 既存の特例（フェロー）維持
  if ((character.etc || '').includes('被ダメージUP(中)(相手全体/2T)')) {
    total += 0.0875;
  }
  return total;
}


const cardNameDict: Record<string, string[]> = {}; // キャラ名をキー、カード名を値とする辞書

// キャラ名をキーとして、カード名を辞書に追加
characters.value.forEach(character => {
  if (character.rare != 'SSR') return;

  // キャラ名をキーとして初期化
  if (!cardNameDict[character.chara]) {
    cardNameDict[character.chara] = [];
  }

  cardNameDict[character.chara].push(character.name);

});

// モーダル関連
const dialogVisible = ref(false);
const selectedDamageList = ref<DamageByCard[]>([]);
const selectedCardName = ref('');
const selectedElement = ref<ElementType>('fire');
const currentPage = ref(1);
const itemsPerPage = ref(10);

// ページネーション用の計算プロパティを追加
const paginatedDamageList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return sortedDamageList.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(selectedDamageList.value.length / itemsPerPage.value);
});

function openDamageModal(charaName: string, element: ElementType) {
  const damageDict = getDamageListByElement(element as 'fire' | 'water' | 'flora' | 'cosmic');
  const cardList = cardNameDict[charaName];
  if (!cardList || cardList.length === 0) return;
  
  const allDamageList = cardList.flatMap(card => {
    const damageList = damageDict[card] || [];
    return damageList.map(damage => ({
      ...damage,
      cardName: card // カード名を追加
    }));
  });

  selectedDamageList.value = allDamageList;
  
  selectedCardName.value = charaName;
  selectedElement.value = element;
  currentPage.value = 1; // ページをリセット
  dialogVisible.value = true;
}

// 型定義の追加
type ElementType = 'fire' | 'water' | 'flora' | 'cosmic';

type SearchPlacement = 'hand' | 'support';

type DeckSearchOptionKey = 'hand-hand' | 'support-hand' | 'hand-support';

interface DeckSearchOption {
  key: DeckSearchOptionKey;
  finisherPlacement: SearchPlacement;
  bufferPlacement: SearchPlacement;
}

interface DeckSearchDamageEntry {
  finisherCardName: string;
  bufferName: string;
  bufferSource: string;
}

const deckSearchOptions: DeckSearchOption[] = [
  {
    key: 'hand-hand',
    finisherPlacement: 'hand',
    bufferPlacement: 'hand',
  },
  {
    key: 'support-hand',
    finisherPlacement: 'support',
    bufferPlacement: 'hand',
  },
  {
    key: 'hand-support',
    finisherPlacement: 'hand',
    bufferPlacement: 'support',
  }
];

function getDamageListByElement(element: ElementType) {
  const dict = {
    fire: fireDamageListByCardDict,
    water: waterDamageListByCardDict,
    flora: floraDamageListByCardDict,
    cosmic: cosmicDamageListByCardDict
  };
  return dict[element];
}

function getBasicExamPresetName(element: ElementType): string {
  switch (element) {
    case 'fire':
      return 'settingModal.preset.fireBasicExam';
    case 'water':
      return 'settingModal.preset.waterBasicExam';
    case 'flora':
      return 'settingModal.preset.floraBasicExam';
    case 'cosmic':
      return 'settingModal.preset.neutralBasicExam';
  }
}

function getPlacementLabel(placement: SearchPlacement): string {
  return placement === 'hand'
    ? t('finisherDamage.handCollection')
    : t('finisherDamage.supportLabel');
}

function loadSavedCharacterLevels() {
  try {
    const raw = localStorage.getItem('characterLevels');
    savedCharacterLevels.value = raw ? JSON.parse(raw) as Record<string, number> : {};
  } catch (error) {
    console.warn('Failed to load character levels from localStorage:', error);
    savedCharacterLevels.value = {};
  }
}

function getCardLevel(cardName: string): number {
  const storeLevel = characters.value.find(character => character.name === cardName)?.level ?? 0;
  const savedLevel = savedCharacterLevels.value[cardName] ?? 0;
  return Math.max(storeLevel, savedLevel);
}

function hasSpecificBufferCard(entry: DeckSearchDamageEntry): boolean {
  return !!entry.bufferSource && characters.value.some(character => character.name === entry.bufferName);
}

function isDeckSearchOptionDisabled(
  entry: DeckSearchDamageEntry,
  option: DeckSearchOption
): boolean {
  if (option.finisherPlacement === 'hand' && getCardLevel(entry.finisherCardName) <= 0) {
    return true;
  }

  if (
    option.bufferPlacement === 'hand' &&
    hasSpecificBufferCard(entry) &&
    getCardLevel(entry.bufferName) <= 0
  ) {
    return true;
  }

  return false;
}

function getCharacterNameJa(name: string): string | null {
  if (!name) return null;

  const matchedCard = characters.value.find(character => character.name === name);
  if (matchedCard) {
    return matchedCard.chara;
  }

  const matchedCharacter = (characterDataJson as CharacterInfo[]).find(character => (
    character.name_ja === name || character.name_en === name
  ));
  return matchedCharacter?.name_ja || null;
}

function getSupportCardNames(name: string): string[] {
  if (!name) return [];

  const matchedCard = characters.value.find(character => character.name === name);
  if (matchedCard) {
    return [matchedCard.name];
  }

  const characterNameJa = getCharacterNameJa(name);
  if (!characterNameJa) return [];

  return characters.value
    .filter(character => character.rare === 'SSR' && character.chara === characterNameJa)
    .map(character => character.name);
}

function getRequiredBuddyCharacterNames(cardName: string): string[] {
  const character = characters.value.find(char => char.name === cardName);
  if (!character) return [];

  const buddyNames: string[] = [];
  if (character.buddy1c && character.buddy1s.includes('ATK')) {
    buddyNames.push(character.buddy1c);
  }
  if (character.buddy2c && character.buddy2s.includes('ATK')) {
    buddyNames.push(character.buddy2c);
  }
  if (character.buddy3c && character.buddy3s.includes('ATK')) {
    buddyNames.push(character.buddy3c);
  }
  return buddyNames;
}

function resetRequiredCards() {
  characters.value.forEach(character => {
    character.required = false;
  });
}

function setRequiredCard(cardName: string) {
  const target = characters.value.find(character => character.name === cardName);
  if (target) {
    target.required = true;
  }
}

async function openDeckSearchFromDamageEntry(
  entry: DeckSearchDamageEntry,
  element: ElementType,
  option: DeckSearchOption
) {
  if (!entry.finisherCardName) return;

  const defaults = createDefaultSearchSettingsState();
  const preset = SEARCH_PRESET_CONFIGURATIONS.find(config => config.name === getBasicExamPresetName(element));
  if (!preset) return;

  resetRequiredCards();

  const mustCharacterNames = new Set<string>(getRequiredBuddyCharacterNames(entry.finisherCardName));
  let selectedSupportCharacters = [...defaults.selectedSupportCharacters];

  if (option.finisherPlacement === 'hand') {
    setRequiredCard(entry.finisherCardName);
  } else {
    selectedSupportCharacters = [entry.finisherCardName];
  }

  const bufferCharacterName = getCharacterNameJa(entry.bufferName);
  const isSpecificBufferCard = hasSpecificBufferCard(entry);

  if (option.bufferPlacement === 'hand') {
    if (isSpecificBufferCard) {
      setRequiredCard(entry.bufferName);
    } else if (bufferCharacterName) {
      mustCharacterNames.add(bufferCharacterName);
    }
  } else {
    const supportCards = getSupportCardNames(
      isSpecificBufferCard ? entry.bufferName : (bufferCharacterName || entry.bufferName)
    );
    if (supportCards.length > 0) {
      selectedSupportCharacters = supportCards;
    }
  }

  const convertedMustCharacters = Array.from(mustCharacterNames);
  searchSettingsStore.updateSearchSettings({
    ...defaults,
    ...preset.minSettings,
    sortOptions: preset.sortOptions.map(sortOption => ({ ...sortOption })),
    attackNum: preset.attackNum ?? defaults.attackNum,
    allowSameCharacter: true,
    mustCharacters: convertedMustCharacters.map(name => ({ prop: name })),
    convertedMustCharacters,
    selectedSupportCharacters,
  });

  await router.push({
    name: 'search',
    query: { openSettings: '1' }
  });
}

// ソート関連の状態
const sortColumn = ref<string>('');
const sortDirection = ref<'asc' | 'desc'>('desc');

// ソート機能の実装
function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'desc';
  }
}

// ソート済みのキャラクターデータを計算
const sortedCharacterData = computed(() => {
  let filteredData = [...characterDataJson];
  
  // 手持ち設定に関係なく全キャラクターを表示
  // （各キャラクターの所持状況は getMaxDamage で判定）
  
  if (!sortColumn.value) return filteredData;

  return filteredData.sort((a, b) => {
    const aValue = getMaxDamage(a.name_ja, sortColumn.value as ElementType);
    const bValue = getMaxDamage(b.name_ja, sortColumn.value as ElementType);
    
    // 数値に変換（'-'の場合は0として扱う）
    const aNum = typeof aValue === 'number' ? aValue : 0;
    const bNum = typeof bValue === 'number' ? bValue : 0;
    
    return sortDirection.value === 'asc' 
      ? aNum - bNum 
      : bNum - aNum;
  });
});

// getMaxDamage関数を修正して小数点を切り捨て
function getMaxDamage(charaName: string, element: ElementType): number | string {
  if (charaName === '全キャラ') {
    const damageDict = getDamageListByElement(element);
    let maxDamage = 0;
    
    characters.value
      .filter(character => character.rare === 'SSR')
      .forEach(character => {
        // 手持ち設定を考慮した表示判定
        if (useHandCollection.value) {
          const handCard = handCollectionStore.getHandCard(character.name);
          if (!handCard.isOwned) {
            return; // 所持していない場合は除外
          }
        }
        
        const damageList = damageDict[character.name] || [];
        const characterMaxDamage = Math.max(...damageList.map(d => d.damage), 0);
        maxDamage = Math.max(maxDamage, characterMaxDamage);
      });
    
    return Math.floor(maxDamage);
  }

  // 手持ち設定ONの場合、そのキャラクターのカードを1枚も所持していなければ"-"を返す
  if (useHandCollection.value) {
    const hasOwnedCard = characters.value
      .filter(character => character.rare === 'SSR' && character.chara === charaName)
      .some(character => {
        const handCard = handCollectionStore.getHandCard(character.name);
        return handCard.isOwned;
      });
    
    if (!hasOwnedCard) {
      return '-';
    }
  }

  const dict = {
    fire: maxFireDamageByCharaDict,
    water: maxWaterDamageByCharaDict,
    flora: maxFloraDamageByCharaDict,
    cosmic: maxCosmicDamageByCharaDict
  };
  const value = dict[element]?.[charaName];
  return value ? Math.floor(value) : '-';
}

// ダメージリストを降順でソート
const sortedDamageList = computed(() => {
  return [...selectedDamageList.value].sort((a: DamageByCard, b: DamageByCard) => b.damage - a.damage);
});

// 日本語名から英名を取得する関数
function getEnglishName(japaneseName: string): string {
  const character = characterDataJson.find(char => char.name_ja === japaneseName);
  return character?.name_en as string || '';
}

// Wikiページを開く関数を修正
function openWikiPage(cardName: string | undefined) {
  if (!cardName) return;
  const info = characterInfoMap.value.get(cardName);
  // infoが存在し、かつinfo.wikiUrlが空でない文字列の場合のみページを開く
  if (info && info.wikiUrl) { 
    window.open(info.wikiUrl, '_blank');
  }
}

// 全キャラクター情報モーダル関連の状態を追加
const allCharactersDialogVisible = ref(false);
const allCharactersDamageList = ref<{ cardName: string; damage: number; buffName: string; buffSource: string }[]>([]);
const selectedAllCharactersElement = ref<ElementType>('fire');
const allCharactersCurrentPage = ref(1);
const allCharactersItemsPerPage = ref(10);

// クリティカル状態管理（0: ノーマル, 1: 1クリ, 2: 2クリ, 3: 3クリ）
const criticalLevel = ref(0);
const allCharactersCriticalLevel = ref(0);

// クリティカル倍率の定義
const criticalMultipliers = [1.0, 1.0833, 1.1666, 1.25];

function calcItemsPerPage() {
  // モーダルの最大高さ: 95vh, ヘッダーや余白を差し引く
  const modalMaxHeight = window.innerHeight * 0.95;
  const headerFooterHeight = 60; // ヘッダー・フッター・余白の合計（調整可）
  const availableHeight = modalMaxHeight - headerFooterHeight;
  const itemHeight = 80; // min-height:56px + padding上下24px
  const count = Math.max(1, Math.floor(availableHeight / itemHeight));
  itemsPerPage.value = count;
  allCharactersItemsPerPage.value = count;
}

onMounted(() => {
  calcItemsPerPage();
  window.addEventListener('resize', calcItemsPerPage);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', calcItemsPerPage);
});

// ページネーション用の計算プロパティを追加
const paginatedAllCharactersDamageList = computed(() => {
  const start = (allCharactersCurrentPage.value - 1) * allCharactersItemsPerPage.value;
  const end = start + allCharactersItemsPerPage.value;
  return sortedAllCharactersDamageList.value.slice(start, end);
});

const allCharactersTotalPages = computed(() => {
  return Math.ceil(allCharactersDamageList.value.length / allCharactersItemsPerPage.value);
});

// 全キャラクター情報モーダルを開く関数
function openAllCharactersModal(element: ElementType) {
  selectedAllCharactersElement.value = element;
  const damageDict = getDamageListByElement(element);
  
  // 全キャラクターの全カード・全バフのダメージ情報を結合
  // 手持ち設定ONの場合、計算されていないカードのダメージは自然に除外される
  allCharactersDamageList.value = characters.value
    .filter(character => character.rare === 'SSR')
    .flatMap(character => {
      const damageList = damageDict[character.name] || [];
      // 各カード・バフの全ダメージ情報を取得
      return damageList.map(d => ({
        cardName: character.name,
        damage: d.damage,
        buffName: d.name || '',
        buffSource: d.buffSource || ''
      }));
    });

  allCharactersCurrentPage.value = 1; // ページをリセット
  allCharactersDialogVisible.value = true;
}

// 全キャラクターのダメージリストを降順でソート
const sortedAllCharactersDamageList = computed(() => {
  return [...allCharactersDamageList.value].sort((a, b) => b.damage - a.damage);
});

// バディーカードの情報を取得する関数を修正 (戻り値を日本語名にする)
function getBuddyCards(cardName: string): string[] {
  const character = characters.value.find(char => char.name === cardName);
  if (!character) return [];
  
  const buddyCards: string[] = []; // 日本語名を格納する配列
  if (character.buddy1c && character.buddy1s.includes('ATK')) {
    const buddy1Info = characterInfoMap.value.get(character.buddy1c);
    if (buddy1Info) buddyCards.push(character.buddy1c);
  }
  if (character.buddy2c && character.buddy2s.includes('ATK')) {
    const buddy2Info = characterInfoMap.value.get(character.buddy2c);
    if (buddy2Info) buddyCards.push(character.buddy2c);
  }
  if (character.buddy3c && character.buddy3s.includes('ATK')) {
    const buddy3Info = characterInfoMap.value.get(character.buddy3c);
    if (buddy3Info) buddyCards.push(character.buddy3c);
  }
  
  return buddyCards;
}

// 手持ち設定の切り替え関数
function toggleHandCollection() {
  useHandCollection.value = !useHandCollection.value;
}

// 手持ち設定の変更を監視して再計算を実行
watch(() => useHandCollection.value, () => {
  // 手持ち設定の変更時にダメージを再計算
  recalculateAllDamage();
});

// クリティカル状態切り替え関数（0→1→2→3→0のサイクル）
function toggleCritical() {
  criticalLevel.value = (criticalLevel.value + 1) % 4;
}

function toggleAllCharactersCritical() {
  allCharactersCriticalLevel.value = (allCharactersCriticalLevel.value + 1) % 4;
}

// クリティカルボタンのスタイルを取得する関数（黄色の背景で徐々に濃く）
function getCriticalButtonStyle(level: number): Record<string, string> {
  const backgrounds = [
    'rgba(255, 235, 59, 0.1)', // 0クリ: 最も薄い黄色背景
    'rgba(255, 235, 59, 0.3)', // 1クリ: 薄い黄色背景
    'rgba(255, 235, 59, 0.6)', // 2クリ: 中程度の黄色背景
    'rgba(255, 235, 59, 0.9)'  // 3クリ: 濃い黄色背景
  ];
  
  return {
    'background-color': backgrounds[level],
    'color': '#999999', // 薄いグレー文字
    'border-color': '#e0e0e0' // 薄いグレーの枠線
  };
}

// クリティカルボタンのテキストを取得する関数
function getCriticalButtonText(level: number): string {
  const keys = ['normal', 'critical1', 'critical2', 'critical3'];
  return t(`finisherDamage.${keys[level]}`);
}

// 手持ちコレクションの内容変更を監視
watch(() => handCollectionStore.handCollection, () => {
  if (useHandCollection.value) {
    // 手持ち設定ONの場合のみ再計算
    recalculateAllDamage();
  }
}, { deep: true });

// 全ダメージを再計算する関数
function recalculateAllDamage() {
  if (loading.value) return;
  
  // ダメージ辞書をリセット
  Object.keys(maxFireDamageByCharaDict).forEach(key => delete maxFireDamageByCharaDict[key]);
  Object.keys(maxWaterDamageByCharaDict).forEach(key => delete maxWaterDamageByCharaDict[key]);
  Object.keys(maxFloraDamageByCharaDict).forEach(key => delete maxFloraDamageByCharaDict[key]);
  Object.keys(maxCosmicDamageByCharaDict).forEach(key => delete maxCosmicDamageByCharaDict[key]);
  Object.keys(fireDamageListByCardDict).forEach(key => delete fireDamageListByCardDict[key]);
  Object.keys(waterDamageListByCardDict).forEach(key => delete waterDamageListByCardDict[key]);
  Object.keys(floraDamageListByCardDict).forEach(key => delete floraDamageListByCardDict[key]);
  Object.keys(cosmicDamageListByCardDict).forEach(key => delete cosmicDamageListByCardDict[key]);
  
  // バフ辞書を再構築
  buildEffectDict();
  
  // ダメージを再計算
  calculateDamage();
}

</script>
<style scoped>
.finisher-container {
  padding: 8px;
  max-width: 100%;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.character-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  width: 100%;
  max-width: 800px;
  justify-content: center;
}

.character-item {
  margin: 2px;
  width: var(--icon-size);
  height: var(--icon-size);
  transition: border 0.3s ease;
  flex-shrink: 0;
  margin-right: 0;
}

.character-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1;
  position: relative;
}

.damage-row {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  align-items: center;
  flex: 1;
  margin: 0;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  justify-content: center;
  padding-left: 0;
  max-width: 600px;
}

.damage-row::-webkit-scrollbar {
  display: none;
}

.damage-col {
  min-width: 80px;
  max-width: 120px;
  padding: 0;
  flex: 1;
}

.damage-item {
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 4px;
  text-align: center;
  font-weight: 500;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.vs-text {
  font-weight: bold;
  color: #1976d2;
  font-size: 0.8em;
  white-space: nowrap;
}

.element-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

.clickable-header {
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: all 0.2s ease;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  min-height: 40px;
}

.clickable-header:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  color: #666;
  font-size: 0.8em;
  flex-shrink: 0;
}

.sort-indicator {
  color: #1976d2;
  font-weight: bold;
}

.sort-hint {
  opacity: 0.5;
  font-size: 0.7em;
}

.clickable-damage {
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

@media (max-width: 600px) {
  .character-row {
    max-width: 100%;
  }

  .damage-row {
    max-width: 100%;
  }

  .damage-col {
    min-width: 70px;
  }

  .element-icon {
    width: 20px;
    height: 20px;
  }

  .vs-text {
    font-size: 0.7em;
  }

  .damage-item {
    padding: 2px;
    height: 36px;
  }

  .clickable-damage {
    font-size: 0.8em;
  }

  .damage-value-actions {
    gap: 2px;
  }

  .deck-search-button {
    padding: 0 4px;
    font-size: 0.65rem;
  }

  :deep(.v-overlay__content) {
    margin: 0 !important;
    left: 0 !important;
    right: 0 !important;
    inset: 0 !important;
    width: 100vw !important;
    min-width: 100vw !important;
    max-width: 100vw !important;
    padding: 0 !important;
    position: fixed !important;
    box-sizing: border-box !important;
    padding-top: 12px !important;
  }
  :deep(.v-dialog .v-card) {
    width: 100vw !important;
    min-width: 100vw !important;
    max-width: 100vw !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-sizing: border-box !important;
  }
  :deep(.deck-search-menu-overlay) {
    position: absolute !important;
    inset: auto !important;
    width: auto !important;
    min-width: 280px !important;
    max-width: calc(100vw - 16px) !important;
    padding: 0 !important;
    left: auto !important;
    right: auto !important;
  }
}

.modal-content {
  padding: 0 !important;
  max-height: 95vh;
  overflow-y: auto;
}

.damage-list {
  background: transparent;
  padding: 0;
  margin: 0;
}

.damage-list-item {
  padding: 12px 8px;
  border-bottom: 1px solid #eee;
  background: white;
  margin-bottom: 0px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  min-height: 56px;
  display: flex;
  align-items: center;
}

.damage-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 0;
  margin: 0;
}

.card-info {
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 125px;
  flex: 1;
}

.buff-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
  flex: 1;
  justify-content: flex-start;
}

.buff-container {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  justify-content: flex-start;
}

.buddy-cards {
  display: flex;
  gap: 1px;
  align-items: center;
}

.buff-source {
  font-size: 0.85em;
  font-weight: bold;
  color: #6e7072;
  border-radius: 4px;
  white-space: nowrap;
  margin-left: 0px;
  padding: 0px 0px;
}

.card-icon, .buff-icon {
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  cursor: pointer;
}

.buddy-icon {
  border-radius: 4px;
  object-fit: cover;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12);
  cursor: pointer;
}

.damage-value {
  font-weight: bold;
  color: #1976d2;
  min-width: 90px;
  text-align: right;
  font-size: 1em;
  padding: 0 8px;
  background: #f5f5f5;
  border-radius: 8px;
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.damage-value-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  width: 100%;
}

.deck-search-button {
  min-width: 24px;
  width: 24px;
  height: 24px;
  padding: 0;
  letter-spacing: 0;
}

.deck-search-menu-list {
  min-width: 280px;
  max-width: 320px;
}

.deck-search-menu-description {
  padding: 12px 16px 4px;
  font-size: 0.85rem;
  line-height: 1.4;
  white-space: normal;
}

.deck-search-table {
  padding: 4px 12px 12px;
}

.deck-search-table-header,
.deck-search-table-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: center;
  gap: 8px;
}

.deck-search-table-header {
  padding: 4px 8px 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #5f6368;
}

.deck-search-table-icon-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.deck-search-table-row {
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: #f7f9fc;
  color: #1f2937;
  text-align: left;
  font-size: 0.82rem;
  cursor: pointer;
  margin-top: 4px;
}

.deck-search-table-row:hover {
  background: #e8f1ff;
}

.deck-search-table-row:disabled {
  background: #eef1f4;
  color: #9aa1a9;
  cursor: not-allowed;
}

.deck-search-table-row:disabled .deck-search-table-open {
  color: #9aa1a9;
}

.deck-search-table-open {
  color: #1976d2;
  font-weight: 700;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
}

.loading-text {
  color: #666;
  font-size: 1.2em;
  margin-top: 8px;
}

.all-characters-row {
  margin-top: 16px;
  border-top: 2px solid #e0e0e0;
  padding-top: 8px;
}

.all-characters-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: bold;
  color: #1976d2;
  background-color: #e3f2fd;
  border-radius: 8px;
}

.all-characters-item {
  background-color: #e3f2fd;
  border: 1px solid #1976d2;
}

.v-dialog .v-card {
  margin-left: auto !important;
  margin-right: auto !important;
}

:deep(.v-card.v-theme--light.v-card--density-default.v-card--variant-elevated) {
  margin: 7px !important;
  margin-top: 20px !important;
}

.close-btn {
  min-width: 80px;
  font-weight: bold;
  letter-spacing: 1px;
}

.critical-btn {
  min-width: 90px;
  font-weight: bold;
  letter-spacing: 1px;
  margin-right: 8px;
}

.toggle-button {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8em;
  color: #666;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.toggle-button:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

.toggle-button.active {
  background-color: #1976d2;
  border-color: #1976d2;
  color: white;
}
</style>
