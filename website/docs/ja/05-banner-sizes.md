---
title: "バナーサイズの選び方"
description: "固定サイズとアダプティブサイズの使い分けと、アダプティブサイズを使うときの注意点。"
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

## 固定サイズ

`BANNER`（320×50）、`LARGE_BANNER`（320×100）、`MEDIUM_RECTANGLE`（300×250）は、どの端末でも使えます。

`FULL_BANNER`（468×60）と `LEADERBOARD`（728×90）はタブレット向けです。スマートフォンでリクエストするとロードには成功しますが、表示は警告なくクリップされます。エラーもダウンスケールもレイアウト警告も出ず、挙動は両プラットフォームで同じです。タブレットを対象にしないなら、この2つは使わないでください。

## アダプティブサイズ

3つとも同期関数です。広告が届く前に表示領域を確保できます。

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

**アダプティブヘルパーが返したサイズは、そのまま渡してください。** `{ width: size.width, height: 100 }` のように数値から作り直すと、[`adaptiveKind`](/ja/api#banneradadaptivekind) のマーカーが失われます。この場合、ネイティブ側はその高さちょうどの固定バナーをリクエストします。エラーは出ず、リクエストがアダプティブでなくなるだけです。

### 回転したら計算し直す

アンカー型のアダプティブサイズは、縦向きと横向きで高さが変わります。`orientation` が `'current'`（既定）のときは、端末が回転したらサイズを計算し直してください。これを行うのが [`useBannerAdSize()`](/ja/api#usebanneradsizespec) です。

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

### インラインは指定より低く返ることがある

`inlineAdaptive` が返す `height` は**最大値**であり、最終的な高さではありません。配信される広告は、これより低いことがあります。ロード後は [`ad.loadedSize`](/ja/api#bannerad) に実際のサイズが入ります。`adaptiveKind` も引き継ぐため、そのまま `size` オプションに渡せます。

`maxHeight` は必須です。最低32dp で、50dp 以上を推奨します。
