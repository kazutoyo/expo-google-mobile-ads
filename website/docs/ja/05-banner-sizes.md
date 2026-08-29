---
title: "バナーサイズの選び方"
description: "固定サイズとアダプティブサイズのどれを使うか、そしてアダプティブサイズに付いてくる1つのルール。"
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

## 固定サイズ

`BANNER`（320×50）、`LARGE_BANNER`（320×100）、`MEDIUM_RECTANGLE`（300×250）はどの端末でも使えます。

`FULL_BANNER`（468×60）と `LEADERBOARD`（728×90）はタブレット向けです。スマートフォンでリクエストするとロードには成功して、そのあと無言でクリップされます。エラーもダウンスケールもレイアウト警告もなく、両プラットフォームで同じ挙動です。タブレットを狙わないなら、この2つは避けてください。

## アダプティブサイズ

3つとも同期関数なので、広告が届く前に表示領域を確保できます。

| 関数 | 高さ | 用途 |
| --- | --- | --- |
| [`largeAnchoredAdaptive(options?)`](/ja/api#banneradsizelargeanchoredadaptiveoptions) | 50〜150dp | 画面の上下に固定するバナーの既定の選択肢 |
| [`anchoredAdaptive(options?)`](/ja/api#banneradsizeanchoredadaptiveoptions) | 50〜90dp | 同じ用途で、`largeAnchoredAdaptive` の占有面積がレイアウトに収まらないとき。両プラットフォームで非推奨のネイティブ API をラップしています |
| [`inlineAdaptive(options)`](/ja/api#banneradsizeinlineadaptiveoptions) | `maxHeight` まで | フィードなど、スクロールするコンテンツの中に置くバナー |

```typescript
const size = BannerAdSize.largeAnchoredAdaptive();
const inline = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

### サイズは丸ごと渡す

**アダプティブヘルパーが返したサイズは、そのまま渡してください。** 数値から作り直すと（`{ width: size.width, height: 100 }` のように）[`adaptiveKind`](/ja/api#banneradadaptivekind) のマーカーが落ちて、ネイティブ側はその高さちょうどの固定バナーをリクエストします。エラーは出ません。リクエストがアダプティブでなくなるだけです。

### 回転したら計算し直す

アンカー型のアダプティブサイズは、縦向きと横向きで解決される高さが変わります。`orientation` が `'current'`（既定）のときは、端末が回転したらサイズを計算し直す必要があります。それをやるのが [`useBannerAdSize()`](/ja/api#usebanneradsizespec) です。

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

### インラインは指定より低く返ることがある

`inlineAdaptive` で返る `height` は**最大値**で、最終的な高さではありません。配信される広告はもっと低いことがあります。ロード後は [`ad.loadedSize`](/ja/api#bannerad) が実際に届いたサイズを持っていて、`adaptiveKind` も引き継ぐので、そのまま `size` オプションに渡せます。

`maxHeight` は必須で、最低32dp、50dp 以上を推奨します。
