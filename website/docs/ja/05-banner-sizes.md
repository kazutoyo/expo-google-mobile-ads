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

`FULL_BANNER` と `LEADERBOARD` はタブレット向けのサイズである。スマートフォンでリクエストしてもロード自体は成功し、その後**無言でクリップされる**——エラーもダウンスケールもレイアウト警告もなく、両 OS で同じ挙動になる。コンテナが広がって全体を収めることはなく、後続のコンテンツは通常どおり確保された高さのままで、はみ出た部分を見るための横スクロールも発生しない。タブレットを対象としないなら、この2つは避けること。

アダプティブサイズ（いずれも同期関数。ロードを待たずに表示領域を確定できる）:

| 関数 | 高さの範囲 | 備考 |
|---|---|---|
| `BannerAdSize.anchoredAdaptive(options?)` | 50〜90dp | 対応するネイティブ API（Android/iOS 双方）は**非推奨**。将来の SDK メジャーで削除される可能性がある |
| `BannerAdSize.largeAnchoredAdaptive(options?)` | 50〜150dp | `anchoredAdaptive` の後継。ポートレート高さの20%以内で、動画広告の需要が高い場合に大きめの領域を確保する |
| `BannerAdSize.inlineAdaptive(options)` | `options.maxHeight` まで | スクロール内（フィード内など）に置くためのサイズ。実際に配信される広告は `maxHeight` より低いことがある——詳細は後述 |

3つのアダプティブヘルパーはいずれも、返すサイズに `adaptiveKind: BannerAdAdaptiveKind` というマーカーを付与する——`'anchored' | 'anchoredPortrait' | 'anchoredLandscape' | 'largeAnchored' | 'largeAnchoredPortrait' | 'largeAnchoredLandscape' | 'inline'` で、パッケージルートからエクスポートされている。両ネイティブ SDK とも「アダプティブ」を width/height の値としてではなく、広告サイズ型上のフラグとして表現している（iOS の `GADAdSize.flags`、Android の `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner`）ため、この2つの数値だけからは復元できない。このフィールドは、以前あった `inlineAdaptive?: boolean` を置き換えたものである——その boolean はインラインアダプティブしかカバーしておらず、**アンカー型**のアダプティブサイズが素の `{ width, height }` として JS の境界を越えると、ネイティブ側でちょうどそのサイズの固定カスタムリクエストとして再構築されてしまい、アプリ側から観測できるものが何もないまま広告が無言でアダプティブでなくなっていた。`adaptiveKind` は3系統すべてをカバーする。

向きは別フィールドにせず、このマーカーに畳み込んである。アンカー型のサイズは向きによって実際に異なるためで——実機で計測すると、`largeAnchoredLandscape` は 338×80 なのに対し `largeAnchored` は 338×106 である。向きを落として3種類に単純化すると、ネイティブ側で現在の向き用のファクトリを通してサイズを再構築する必要が生じ、このフィールドが解消しようとしている無言のミスマッチを再び持ち込んでしまう。

**3つのアダプティブヘルパーのいずれかが生成した `BannerAdSize` は、そのまま丸ごと渡す必要がある。** `width` と `height` から作り直す——例えば `{ width: size.width, height: 100 }`——と `adaptiveKind` が落ち、ネイティブ側はその高さちょうどの固定バナーとしてサイズを再構築する。エラーは出ない。リクエストが無言でアダプティブでなくなるだけである。

`anchoredAdaptive` は非推奨のネイティブ API をラップしているが、意図して提供している。高さが低く抑えられるぶんレイアウトへの影響が小さいため、`largeAnchoredAdaptive` の大きな占有面積を避けたい場合の選択肢として残してある。TypeScript の `@deprecated` は付けていない — 意図して使う利用者に無用な警告を出さないためである。

`anchoredAdaptive` / `largeAnchoredAdaptive` の `options` は `{ width?: number; orientation?: 'current' | 'portrait' | 'landscape' }`（既定は画面幅・`'current'`）。画面回転に追従してサイズを再計算したい場合は `useBannerAdSize(spec)` hook を使う。

```typescript
import { useBannerAdSize } from '@kazutoyo/expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

## inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` は `maxHeight` を**必須**とし、`orientation` オプションは持たない:

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` は返すサイズに `adaptiveKind: 'inline'` をセットする——サイズを丸ごと渡す必要がある理由は前述のとおり。

`maxHeight` に既定値がないのは意図的である。各 SDK の「最大高さなし」用ヘルパーは、誰もレイアウトとして確保できない値を返す——iOS はセンチネルとして高さ `0` を返し、Android は画面の全高を返す。この関数が代わりに何らかの既定値を選んだとしても、それは呼び出し側が求めてもいない恣意的なレイアウト確保になってしまう。だからこの関数は既定値を選ばず、呼び出し側に委ねている。`maxHeight` は最低32dp、推奨は50dp以上である。`orientation` オプションもない——アンカー型のサイズと異なり、インラインアダプティブの最大高さ形式は両OSともに画面の向きに依存しないためである。

返される `height` は**最大値**であり、最終的な高さではない——実際に配信される広告はそれより低いことがある。ロード後の実寸が必要な場合は、リクエストしたサイズではなく `ad.loadedSize` を使うこと。ロード完了時にこれが実際に届いたサイズを報告し、`adaptiveKind` も引き継いでいるため、`useBannerAd` の `size` オプションにそのまま渡しても無言で固定サイズに劣化することはない。
