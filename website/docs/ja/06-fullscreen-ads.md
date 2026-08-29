---
title: "インタースティシャル / リワード広告"
description: "使い切りの全画面広告。描画ではなく表示するもので、報酬の獲得判定には決まりがあります。"
---

フルスクリーン広告に View はありません。生成して表示するもので、レンダリングするものではないためです。`createInterstitialAd({ adUnitId, requestOptions })` と `createRewardedAd({ adUnitId, requestOptions })` は、生成した瞬間にロードを始める `SharedObject` を返します（バナーと同じく `initialize()` の完了までは内部のキューに積まれます）。`createBannerAd` と同様に React の外から呼べるので、アプリ起動時でも画面遷移の前でも構いません。

```typescript
import { createInterstitialAd, createRewardedAd } from '@kazutoyo/expo-google-mobile-ads';

export const interstitialAd = createInterstitialAd({
  adUnitId: 'ca-app-pub-3940256099942544/1033173712',
});

export const rewardedAd = createRewardedAd({
  adUnitId: 'ca-app-pub-3940256099942544/5224354917',
});
```

## hooks

[バナー用 hooks](/ja/banner-ads) と同じ所有権の区分が、2つの広告タイプ分あります。

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useInterstitialAd(options)` | する | **する** |
| `useInterstitialAdState(ad)` | しない（既存の `ad` を購読） | **しない** |
| `useRewardedAd(options)` | する | **する** |
| `useRewardedAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

```tsx
import { useInterstitialAd } from '@kazutoyo/expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded } = useInterstitialAd({
    adUnitId: 'ca-app-pub-3940256099942544/1033173712',
  });

  return (
    <Button
      title="Show ad"
      disabled={!isLoaded}
      // show() は ShowAdError で reject する。未処理のままにしない
      onPress={() => ad.show().catch((error) => console.warn(error))}
    />
  );
}
```

プリロード済みの広告（上の `interstitialAd` など）の状態を購読するだけなら `useInterstitialAdState` / `useRewardedAdState` を使います。どちらも生成も release もしないので、`ad` のライフタイムは呼び出し側が持つことになります。

## 単発利用

フルスクリーン広告は一度しか表示できません。`show()` の後、`status` は `'shown'` になります。これは**終端状態**で、`load()` を呼んでも何も起きません。両プラットフォームの SDK 側も独自にこれを強制しているので（iOS は `AdAlreadyUsed`、Android は `AD_REUSED`）、回避する方法はありません。次のインプレッションには `createInterstitialAd` / `createRewardedAd` で作り直してください。

## `show()`

```typescript
show(): Promise<void>;             // InterstitialAd
show(): Promise<AdReward | null>;  // RewardedAd
```

ユーザーが広告を閉じた時点で resolve します。リワード広告なら獲得した `AdReward`、獲得せずに閉じたなら `null` が返ります。

`ShowAdError` で reject します。`code` は次のいずれかです。

- `notLoaded` — 広告がまだ準備できていません。`show()` の前に `isLoaded` を確認してください
- `alreadyShown` — この広告の `status` はもう `'shown'` です
- `failedToShow` — SDK 自体が表示を拒否しました

**`show()` はロード中の広告をあえて待ちません。** 「ロードが終わり次第」表示すると、すでに別のことに移ったユーザーの邪魔をしかねないためです。Google 自身のポリシーガイダンスが警告しているのがまさにこれです。ロードの後ろに `show()` を積むのではなく、`isLoaded` を見て、準備できていなければその回は諦めるのがよいかと思います。

## `ad.reward` は獲得した証拠ではない

`RewardedAd` の `reward` は、その広告が**提供するもの**を表しています。ロードが終わった時点、まだ一度も表示していない段階で読めます。ユーザーに「何がもらえるか」を先に見せるためのものです。**獲得した証拠ではありません。** 特に iOS では表示前からこの値が埋まっているので、値があることをもって「視聴した」とみなすと、開いてすぐ閉じたユーザーにも報酬が出てしまいます。

**獲得したかどうかの唯一の正しい情報源は `show()` が resolve する値です。** 付与はそこで行ってください。`ad.reward` から付与してはいけません。

```typescript
try {
  const reward = await rewardedAd.show(); // AdReward | null
  if (reward) {
    // `reward.amount` 個の `reward.type` を付与する
  }
} catch (error) {
  // ShowAdError — 表示できなかった。報酬なしで進める
}
```
