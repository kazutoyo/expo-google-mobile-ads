---
title: "インタースティシャル / リワード広告"
description: "使い切りの全画面広告。表示するものであって描画するものではなく、報酬の獲得判定には決まりがあります。"
---

フルスクリーン広告に View はありません。レンダリングするものではなく、生成して表示するものだからです。

`createInterstitialAd({ adUnitId, requestOptions })` と `createRewardedAd({ adUnitId, requestOptions })` は `SharedObject` を返し、生成した瞬間にロードを始めます（バナーと同じく、`initialize()` が終わるまでは内部のキューに積まれます）。`createBannerAd` と同様に React の外から呼べるため、アプリの起動時でも画面遷移の前でも呼び出せます。

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

[バナー用 hooks](/ja/banner-ads) と同じ所有権の区分が、広告タイプごとにあります。

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

プリロード済みの広告（上の `interstitialAd` など）の状態を購読するだけなら、`useInterstitialAdState` / `useRewardedAdState` を使います。どちらも生成も release もしないため、`ad` のライフタイムは呼び出し側が持ちます。

## 単発利用

フルスクリーン広告は一度しか表示できません。`show()` の後、`status` は `'shown'` になります。これは**終端状態**で、`load()` を呼んでも何も起きません。両プラットフォームの SDK 自体もこの制約を課しているため（iOS は `AdAlreadyUsed`、Android は `AD_REUSED`）、回避する方法はありません。次のインプレッションには、`createInterstitialAd` / `createRewardedAd` で広告を作り直してください。

## `show()`

```typescript
show(): Promise<void>;             // InterstitialAd
show(): Promise<AdReward | null>;  // RewardedAd
```

ユーザーが広告を閉じた時点で resolve します。リワード広告では、獲得した `AdReward`、獲得せずに閉じた場合は `null` を返します。

失敗時は `ShowAdError` で reject します。`code` は次のいずれかです。

- `notLoaded` — 広告がまだ準備できていません。`show()` の前に `isLoaded` を確認してください
- `alreadyShown` — この広告の `status` はすでに `'shown'` です
- `failedToShow` — SDK 自体が表示を拒否しました

**`show()` は、ロード中の広告を意図的に待ちません。** 「ロードが終わり次第」表示すると、すでに別の操作に移ったユーザーを妨げるおそれがあります。Google のポリシーガイダンスも、これを避けるよう警告しています。ロードの完了に `show()` をつなぐのではなく、`isLoaded` を確認し、準備できていなければその回の表示は見送ってください。

## `ad.reward` は獲得した証拠ではない

`RewardedAd` の `reward` は、その広告が**提供する報酬**を表します。ロードが終わった時点、つまりまだ一度も表示していない段階で読み取れます。ユーザーに「何がもらえるか」を先に提示するための値です。**獲得した証拠ではありません。** 特に iOS では表示前からこの値が入っているため、値の有無で「視聴した」と判定すると、開いてすぐ閉じたユーザーにも報酬を与えてしまいます。

**獲得したかどうかの唯一の正しい情報源は、`show()` が resolve する値です。** 報酬の付与はそこで行い、`ad.reward` からは行わないでください。

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
