---
title: "インタースティシャル / リワード広告"
description: "使い切りの全画面広告。描画ではなく表示するもので、報酬の獲得判定には決まりがある。"
---

フルスクリーン広告には View がない——生成して表示するものであり、レンダリングするものではない。`createInterstitialAd({ adUnitId, requestOptions })` と `createRewardedAd({ adUnitId, requestOptions })` は、生成した瞬間にロードを開始する `SharedObject` を返す。`createBannerAd` と同様に、React の外——アプリ起動時や画面遷移前——で呼べる。

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

[バナー用 hooks](/ja/banner-ads) と同じ所有権の区分が、2つの広告タイプ分だけある:

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

  return <Button title="Show ad" disabled={!isLoaded} onPress={() => ad.show()} />;
}
```

プリロード済みの広告（上記の `interstitialAd` など）の状態を購読するだけなら、`useInterstitialAdState` / `useRewardedAdState` を使う——どちらも渡された `ad` の生成も release も行わない。呼び出し側が `ad` のライフタイムを管理する。

## 単発利用

フルスクリーン広告は一度しか表示できない。`show()` の後、`status` は `'shown'` になり、これは**終端状態**である——この状態の広告に `load()` を呼んでも何も起きない。両プラットフォームの SDK 自体もこれを独自に強制している（iOS は `AdAlreadyUsed`、Android は `AD_REUSED` を報告する）ため、回避する方法はない。次のインプレッションには `createInterstitialAd` / `createRewardedAd` で新しい広告を作ること。

## `show()`

```typescript
show(): Promise<void>;             // InterstitialAd
show(): Promise<AdReward | null>;  // RewardedAd
```

ユーザーが広告を閉じると resolve する。リワード広告の場合は、ユーザーが獲得した `AdReward` で resolve するか、獲得せずに閉じた場合は `null` で resolve する。

`ShowAdError` で reject し、その `code` は次のいずれかになる:

- `notLoaded` —広告がまだ準備できていない。`show()` を呼ぶ前に `isLoaded` を確認すること
- `alreadyShown` — この広告の `status` はすでに `'shown'` である
- `failedToShow` — SDK 自体が表示を拒否した

**`show()` はロード中の広告をあえて待たない。** フルスクリーン広告を「ロードが終わり次第」表示すると、すでに別のことに気を移したユーザーの邪魔をしかねない——これはまさに Google 自身のポリシーガイダンスが警告している挙動である。ロードの後ろに `show()` 呼び出しをキューイングするのではなく、`isLoaded` を確認して、準備できていなければその広告は諦めること。

## `ad.reward` は獲得した証拠ではない

`RewardedAd` の `reward` プロパティは、その広告が**提供するもの**である——ロードが終わり次第、まだ一度も表示されていない時点で読み取れる。これはプロンプトでユーザーに「何がもらえるか」を伝えるためのものだ。**これは報酬を獲得した証拠ではない。** 特に iOS では、この値は広告が表示される前の時点ですでに埋まっているため、その値が存在することだけをもって「ユーザーが広告を視聴した」とみなすと、表示直後に閉じたユーザーにも報酬を与えてしまう。

**報酬が獲得されたかどうかの唯一の正しい情報源は、`show()` が resolve する値である。** 報酬はそこで付与すること——`ad.reward` からは絶対に付与しないこと。

```typescript
const reward = await rewardedAd.show(); // AdReward | null
if (reward) {
  // `reward.amount` 個の `reward.type` を付与する
}
```
