---
title: "BannerAdSize"
description: "固定サイズとアダプティブサイズ、そしてアダプティブサイズを丸ごと渡す必要がある理由。"
---

```typescript
import { BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

固定サイズは次のとおりです。

| 定数 | サイズ (dp) |
|---|---|
| `BannerAdSize.BANNER` | 320×50 |
| `BannerAdSize.LARGE_BANNER` | 320×100 |
| `BannerAdSize.MEDIUM_RECTANGLE` | 300×250 |
| `BannerAdSize.FULL_BANNER` | 468×60 |
| `BannerAdSize.LEADERBOARD` | 728×90 |

`FULL_BANNER` と `LEADERBOARD` はタブレット向けです。スマートフォンでリクエストしてもロード自体は成功して、そのあと**無言でクリップされます**。エラーもダウンスケールもレイアウト警告もなく、両 OS で同じ挙動です。コンテナは広がりませんし、後続のコンテンツは確保済みの高さのまま、はみ出た部分を見る横スクロールも出ません。タブレットを狙わないなら、この2つは避けたほうがよいかと思います。

アダプティブサイズは次のとおりです。いずれも同期関数なので、ロードを待たずに表示領域を確定できます。

| 関数 | 高さの範囲 | 備考 |
|---|---|---|
| `BannerAdSize.anchoredAdaptive(options?)` | 50〜90dp | 対応するネイティブ API（Android/iOS 双方）は**非推奨**。将来の SDK メジャーで削除される可能性がある |
| `BannerAdSize.largeAnchoredAdaptive(options?)` | 50〜150dp | `anchoredAdaptive` の後継。ポートレート高さの20%以内で、動画広告の需要が高い場合に大きめの領域を確保する |
| `BannerAdSize.inlineAdaptive(options)` | `options.maxHeight` まで | スクロール内（フィード内など）に置くためのサイズ。配信される広告は `maxHeight` より低いことがある（後述） |

3つのアダプティブヘルパーは、返すサイズに `adaptiveKind: BannerAdAdaptiveKind` というマーカーを付けます。値は `'anchored' | 'anchoredPortrait' | 'anchoredLandscape' | 'largeAnchored' | 'largeAnchoredPortrait' | 'largeAnchoredLandscape' | 'inline'` で、パッケージルートからエクスポートしています。

両ネイティブ SDK は「アダプティブ」を width/height の値ではなく、広告サイズ型のフラグで表しています（iOS は `GADAdSize.flags`、Android は `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner`）。そのため、2つの数値だけからは復元できません。

このフィールドは、以前あった `inlineAdaptive?: boolean` を置き換えたものです。あの boolean はインラインしかカバーしていませんでした。**アンカー型**のアダプティブサイズが素の `{ width, height }` で JS の境界を越えると、ネイティブ側はちょうどそのサイズの固定カスタムリクエストとして組み直してしまいます。アプリからは何も観測できないまま、広告が無言でアダプティブでなくなっていました。`adaptiveKind` は3系統すべてを拾います。

向きは別フィールドにせず、このマーカーに畳み込んでいます。アンカー型のサイズは向きで実際に変わるためです。実機で測ると `largeAnchored` が 338×106、`largeAnchoredLandscape` は 338×80 でした。向きを落として3種類に単純化すると、ネイティブ側で現在の向き用のファクトリを通して組み直すことになり、このフィールドが潰したはずの無言のミスマッチが戻ってきてしまいます。

**アダプティブヘルパーが返した `BannerAdSize` は、丸ごと渡してください。** `width` と `height` から作り直すと（`{ width: size.width, height: 100 }` のように）`adaptiveKind` が落ちて、ネイティブ側はその高さちょうどの固定バナーとして組み直します。エラーは出ません。リクエストが黙ってアダプティブでなくなるだけなので、気づきにくいです。

`anchoredAdaptive` は非推奨のネイティブ API をラップしていますが、これは意図的に残しています。高さが低いぶんレイアウトへの影響が小さく、`largeAnchoredAdaptive` の占有面積を避けたいときの選択肢になるためです。TypeScript の `@deprecated` は付けていません。意図して使う方に無用な警告を出さないためです。

`anchoredAdaptive` / `largeAnchoredAdaptive` の `options` は `{ width?: number; orientation?: 'current' | 'portrait' | 'landscape' }` です（既定は画面幅と `'current'`）。画面回転に追従させたい場合は `useBannerAdSize(spec)` を使います。

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

## inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` は `maxHeight` が**必須**で、`orientation` オプションは持ちません。

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` は返すサイズに `adaptiveKind: 'inline'` をセットします。丸ごと渡す必要がある理由は前述のとおりです。

`maxHeight` に既定値がないのは意図的です。各 SDK の「最大高さなし」ヘルパーは、レイアウトとして確保しようのない値を返します。iOS はセンチネルの `0`、Android は画面の全高です。ここで何か既定値を選ぶと、呼び出し側が求めていない領域を勝手に確保することになってしまうので、選ばずに委ねています。`maxHeight` は最低32dp、50dp 以上を推奨します。`orientation` がないのは、アンカー型と違ってインラインの最大高さ形式が両 OS とも画面の向きに依存しないためです。

返る `height` は**最大値**で、最終的な高さではありません。配信される広告はもっと低いこともあります。ロード後の実寸は `ad.loadedSize` が持っています。`adaptiveKind` も引き継ぐので、`useBannerAd` の `size` にそのまま渡しても、黙って固定サイズに落ちることはありません。
