---
title: "BannerAdSize"
description: "固定サイズとアダプティブサイズ、そしてアダプティブサイズを丸ごと渡さなければならない理由。"
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

固定サイズ:

| 定数 | サイズ (dp) |
|---|---|
| `BannerAdSize.BANNER` | 320×50 |
| `BannerAdSize.LARGE_BANNER` | 320×100 |
| `BannerAdSize.MEDIUM_RECTANGLE` | 300×250 |
| `BannerAdSize.FULL_BANNER` | 468×60 |
| `BannerAdSize.LEADERBOARD` | 728×90 |

`FULL_BANNER` と `LEADERBOARD` はタブレット向け。スマートフォンでリクエストしてもロードは成功し、そのあと**無言でクリップされる**。エラーもダウンスケールもレイアウト警告もなく、両 OS で同じ挙動になる。コンテナは広がらず、後続のコンテンツは確保済みの高さのまま、はみ出た部分を見る横スクロールも出ない。タブレットを狙わないなら、この2つは避ける。

アダプティブサイズ（いずれも同期関数。ロードを待たずに表示領域を確定できる）:

| 関数 | 高さの範囲 | 備考 |
|---|---|---|
| `BannerAdSize.anchoredAdaptive(options?)` | 50〜90dp | 対応するネイティブ API（Android/iOS 双方）は**非推奨**。将来の SDK メジャーで削除される可能性がある |
| `BannerAdSize.largeAnchoredAdaptive(options?)` | 50〜150dp | `anchoredAdaptive` の後継。ポートレート高さの20%以内で、動画広告の需要が高い場合に大きめの領域を確保する |
| `BannerAdSize.inlineAdaptive(options)` | `options.maxHeight` まで | スクロール内（フィード内など）に置くためのサイズ。配信される広告は `maxHeight` より低いことがある（後述） |

3つのアダプティブヘルパーは、返すサイズに `adaptiveKind: BannerAdAdaptiveKind` というマーカーを付ける。値は `'anchored' | 'anchoredPortrait' | 'anchoredLandscape' | 'largeAnchored' | 'largeAnchoredPortrait' | 'largeAnchoredLandscape' | 'inline'` で、パッケージルートからエクスポートしている。

両ネイティブ SDK は「アダプティブ」を width/height の値ではなく、広告サイズ型のフラグで表す（iOS は `GADAdSize.flags`、Android は `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner`）。2つの数値だけからは復元できない。

このフィールドは以前の `inlineAdaptive?: boolean` を置き換えたものだ。あの boolean はインラインしかカバーしていなかった。**アンカー型**のアダプティブサイズが素の `{ width, height }` で JS の境界を越えると、ネイティブ側はちょうどそのサイズの固定カスタムリクエストとして組み直す。アプリからは何も観測できないまま、広告が無言でアダプティブでなくなっていた。`adaptiveKind` は3系統すべてを拾う。

向きは別フィールドにせず、このマーカーに畳み込んである。アンカー型のサイズは向きで実際に変わるからだ。実機で測ると `largeAnchored` が 338×106、`largeAnchoredLandscape` は 338×80 になる。向きを落として3種類に単純化すると、ネイティブ側で現在の向き用のファクトリを通して組み直すことになり、このフィールドが潰したはずの無言のミスマッチが戻ってくる。

**アダプティブヘルパーが返した `BannerAdSize` は、丸ごと渡す。** `width` と `height` から作り直すと（`{ width: size.width, height: 100 }` のように）`adaptiveKind` が落ち、ネイティブ側はその高さちょうどの固定バナーとして組み直す。エラーは出ない。リクエストが無言でアダプティブでなくなるだけだ。

`anchoredAdaptive` は非推奨のネイティブ API をラップしているが、これは意図的に残している。高さが低いぶんレイアウトへの影響が小さく、`largeAnchoredAdaptive` の占有面積を避けたいときの選択肢になるからだ。TypeScript の `@deprecated` は付けていない。意図して使う人に無用な警告を出さないため。

`anchoredAdaptive` / `largeAnchoredAdaptive` の `options` は `{ width?: number; orientation?: 'current' | 'portrait' | 'landscape' }`（既定は画面幅と `'current'`）。画面回転に追従させるなら `useBannerAdSize(spec)` を使う。

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

## inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` は `maxHeight` を**必須**とし、`orientation` オプションは持たない:

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` は返すサイズに `adaptiveKind: 'inline'` をセットする。丸ごと渡す必要がある理由は前述のとおり。

`maxHeight` に既定値がないのは意図的だ。各 SDK の「最大高さなし」ヘルパーは、レイアウトとして確保しようのない値を返す。iOS はセンチネルの `0`、Android は画面の全高。ここで何か既定値を選べば、呼び出し側が求めていない領域を勝手に確保することになる。だから選ばずに委ねている。`maxHeight` は最低32dp、50dp 以上を推奨。`orientation` もない。アンカー型と違い、インラインの最大高さ形式は両 OS とも画面の向きに依存しないためだ。

返る `height` は**最大値**で、最終的な高さではない。配信される広告はもっと低いことがある。ロード後の実寸は `ad.loadedSize` が持つ。`adaptiveKind` も引き継ぐので、`useBannerAd` の `size` にそのまま渡しても無言で固定サイズに落ちない。
