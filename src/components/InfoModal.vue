<template>
  <div class="modal-background">
    <p><h3>ツール全体について</h3></p>
    <p>ディフェンス試験や実践授業で使用するデッキを探索するツールです。</p>
    <p>入力されたデータをもとに、構築可能なデッキを全探索して結果を表示します。</p>
    <p>端末上で全ての処理を行うため、非常に時間が掛かります。使わないであろうキャラはレベルを0にして探索対象から除外してください。</p>
    <p>全てのカードが凸ステータス有り、M3有りで計算されているため、大体の目安程度で考えてください。</p>
    <p><h3>検索設定について</h3></p>
    <p>ソート設定は指定されたソートキーで結果をソートします。</p>
    <p>検索結果の無バディは、「HPバディが存在しないキャラ数」です。</p>
    <p>実践授業で出来るだけ全員にHPバディを乗せたデッキを作りたい場合は昇順でソート順1に指定すると良いです。</p>
    <p>最低値設定は、指定された値以下のデッキは検索結果に追加しません。処理速度の向上に繋がるので、考慮対象にならない値は弾けるような値を設定してください。</p>
    <p>結果上限数は表示上限を決定しますが、検索結果のソート速度に関わるので、理由のない限り大きくしない方が処理速度が向上します。</p>
    <p></p>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="$emit('close')">閉じる</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
<style scoped>
.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
</style>