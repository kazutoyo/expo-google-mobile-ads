# expo-google-mobile-ads

*([English](./README.md) | 日本語)*

Expo Modules ネイティブな [Google Mobile Ads (AdMob)](https://developers.google.com/admob) SDK ラッパー。現時点ではバナー・インタースティシャル・リワード広告をサポートする。

## なぜこのライブラリか

既存の `react-native-google-mobile-ads` は React Native (TurboModules) 向けであり、Old Architecture との互換を引きずっている。その制約のうち特に大きいのが **広告を先読み（プリロード）できない**ことで、広告は表示する View と一体でしか生成できない。

本ライブラリは Expo Modules API（`SharedObject`）の上に、広告インスタンスと表示 View を分離した設計で作られている。

- **プリロード可能** — `createBannerAd()` は React の外、画面遷移前やアプリ起動時に呼べる。ロードは即座に始まり、View は後から付ければよい
- **画面をまたいで再利用可能** — `<BannerAdView ad={ad} />` はアンマウント時に **破棄せずデタッチのみ**を行う。同じ広告を別の画面で再表示できる
- **hooks ベース** — React から使うときは `useBannerAd` / `useBannerAdState` の薄いラッパーだけで済む
- **レイアウトシフトなし** — `BannerAdSize` のサイズ計算はロード完了を待たない同期関数なので、広告が届く前に表示領域を確定できる

Android は [GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start)、iOS は Google Mobile Ads SDK v13 系を使用する。

## サポート範囲

- **New Architecture 専用**。Old Architecture は対象外
- **Expo SDK 57 以降** — `peerDependencies` で宣言しているため、バージョン不一致のインストールはネイティブビルドまで待たずに npm/yarn の時点で表面化する
- **iOS 16.4 以降**、**Android minSdk 24 以降**。iOS の下限は広告 SDK ではなく Expo 側の要求である（`ExpoModulesCore` が SDK 56 以降 `:ios => '16.4'` を宣言している）。Google Mobile Ads SDK v13 自体は iOS 13 で足りる。アプリの `ios.deploymentTarget` が 16.4 未満だとこの pod はインストールできない
- バナー・インタースティシャル・リワード広告

未対応:

- UMP（同意管理）
- ネイティブ広告
- アプリ起動時広告（App Open）
- リワード広告のサーバーサイド検証

## インストール

```sh
npx expo install expo-google-mobile-ads
```

### config plugin の設定

`app.json`（または `app.config.js`）の `plugins` に AdMob の App ID を渡す。

```json
{
  "expo": {
    "plugins": [
      [
        "expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-3940256099942544~3347511713",
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ]
    ]
  }
}
```

plugin はビルド時に App ID の存在と形式を検証する。未設定、または広告**ユニット** ID（`ca-app-pub-xxxx/yyyy` のようにスラッシュ区切り）を App ID の場所に渡した場合は、ビルドをその場で失敗させ、原因が分かるメッセージを出す。App ID は `ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx`（チルダ区切り）の形式である。この取り違えは AdMob 初心者が最も踏みやすい落とし穴で、放置すると Google SDK 側で分かりにくいクラッシュ（iOS）や例外（Android）になる。

`delayAppMeasurementInit: true` を渡すと、UMP の同意取得が終わるまで計測の送信を遅らせる設定を両 OS に書き込む（フェーズ2の UMP 対応への布石）。

## SDK の初期化

広告をロードする前に、アプリ起動時に一度だけ `initialize()` を呼ぶ。

```typescript
import { initialize } from 'expo-google-mobile-ads';

await initialize();
```

**このライブラリは自動初期化を行わない。** 呼び出しは必ず明示的である。

理由は、初期化と UMP の同意取得の順序について Google 自身の案内が割れているため。旧来の案内は「同意取得が先」（`initialize()` がメディエーションアダプタによる広告プリロードを引き起こすため）、現行の案内は「初期化が先でよい」（初期化自体は個人データを処理せず、`canRequestAds()` が true になるまで広告をリクエストしなければポリシー準拠）としている。ここはアプリごとの法務判断が絡みうる領域であり、ネイティブ側で自動初期化してしまうと、揺れている解釈のどちらかをライブラリが勝手に選び、アプリから変更できなくなる。**この順序を決めるのはアプリであってライブラリではない。**

`initialize()` が呼ばれる前に `createBannerAd()` / `createInterstitialAd()` / `createRewardedAd()` を呼んでもエラーにはならない（ロードは初期化完了まで内部でキューされる）。ただし `initialize()`自体が一度も呼ばれない場合、広告は永久に `loading` のまま止まる。これを検知するため、`initialize()` 未呼び出しの状態で広告を作ると `__DEV__` で警告が出る。

## プリロード

広告インスタンスの生成（＝ロード開始）と、画面への表示は独立している。次の画面へ遷移する前や、アプリ起動時に広告を作っておける。

```typescript
// 例: モジュールスコープ、または画面遷移前のどこかで
import { createBannerAd, BannerAdSize } from 'expo-google-mobile-ads';

export const homeBannerAd = createBannerAd({
  adUnitId: 'ca-app-pub-3940256099942544/9214589741',
  size: BannerAdSize.BANNER,
});
```

```tsx
// 画面コンポーネント側
import { useBannerAdState, BannerAdView } from 'expo-google-mobile-ads';
import { homeBannerAd } from './ads';

function HomeScreen() {
  const { isLoaded } = useBannerAdState(homeBannerAd);

  return <BannerAdView ad={homeBannerAd} />;
}
```

`<BannerAdView>` はマウント時にネイティブ View をアタッチし、**アンマウント時はデタッチのみ**を行って広告そのものは破棄しない。この画面から離れて戻ってきても、再ロードなしに同じ広告を表示できる。広告を明示的に破棄したい場合は `ad.release()` を呼ぶ。

## hooks

2つの hook はそれぞれ広告のライフタイムに対する責務が異なる。

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useBannerAd(options)` | する | **する** |
| `useBannerAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

画面と広告のライフタイムが一致する（プリロードしない）単純なケースでは `useBannerAd` を使う。

```tsx
import { useBannerAd, BannerAdSize, BannerAdView } from 'expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded, error } = useBannerAd({
    adUnitId: 'ca-app-pub-3940256099942544/9214589741',
    size: BannerAdSize.BANNER,
  });

  return <BannerAdView ad={ad} />;
}
```

プリロード済みの広告を画面で使うだけの場合は `useBannerAdState` を使う（前節の例を参照）。この hook は `ad` の生成も release も行わない。呼び出し側が `ad` のライフタイムを管理する。

より詳細な状態変化（インプレッション、クリック、収益イベントなど）を購読したい場合は `ad.addListener(...)` を直接使う。

```typescript
const subscription = ad.addListener('statusChange', ({ status }) => {
  if (status === 'loaded') {
    // ...
  }
});
```

## BannerAdSize

```typescript
import { BannerAdSize } from 'expo-google-mobile-ads';
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
import { useBannerAdSize } from 'expo-google-mobile-ads';

const size = useBannerAdSize({ type: 'largeAnchoredAdaptive' });
```

### inlineAdaptive

`inlineAdaptive({ width?, maxHeight })` は `maxHeight` を**必須**とし、`orientation` オプションは持たない:

```typescript
const size = BannerAdSize.inlineAdaptive({ maxHeight: 200 });
```

`inlineAdaptive` は返すサイズに `adaptiveKind: 'inline'` をセットする——サイズを丸ごと渡す必要がある理由は前述のとおり。

`maxHeight` に既定値がないのは意図的である。各 SDK の「最大高さなし」用ヘルパーは、誰もレイアウトとして確保できない値を返す——iOS はセンチネルとして高さ `0` を返し、Android は画面の全高を返す。この関数が代わりに何らかの既定値を選んだとしても、それは呼び出し側が求めてもいない恣意的なレイアウト確保になってしまう。だからこの関数は既定値を選ばず、呼び出し側に委ねている。`maxHeight` は最低32dp、推奨は50dp以上である。`orientation` オプションもない——アンカー型のサイズと異なり、インラインアダプティブの最大高さ形式は両OSともに画面の向きに依存しないためである。

返される `height` は**最大値**であり、最終的な高さではない——実際に配信される広告はそれより低いことがある。ロード後の実寸が必要な場合は、リクエストしたサイズではなく `ad.loadedSize` を使うこと。ロード完了時にこれが実際に届いたサイズを報告し、`adaptiveKind` も引き継いでいるため、`useBannerAd` の `size` オプションにそのまま渡しても無言で固定サイズに劣化することはない。

## インタースティシャル / リワード広告

フルスクリーン広告には View がない——生成して表示するものであり、レンダリングするものではない。`createInterstitialAd({ adUnitId, requestOptions })` と `createRewardedAd({ adUnitId, requestOptions })` は、生成した瞬間にロードを開始する `SharedObject` を返す。`createBannerAd` と同様に、React の外——アプリ起動時や画面遷移前——で呼べる。

```typescript
import { createInterstitialAd, createRewardedAd } from 'expo-google-mobile-ads';

export const interstitialAd = createInterstitialAd({
  adUnitId: 'ca-app-pub-3940256099942544/1033173712',
});

export const rewardedAd = createRewardedAd({
  adUnitId: 'ca-app-pub-3940256099942544/5224354917',
});
```

### hooks

上記のバナー用 hooks と同じ所有権の区分が、2つの広告タイプ分だけある:

| hook | 広告を生成するか | アンマウント時に release するか |
|---|---|---|
| `useInterstitialAd(options)` | する | **する** |
| `useInterstitialAdState(ad)` | しない（既存の `ad` を購読） | **しない** |
| `useRewardedAd(options)` | する | **する** |
| `useRewardedAdState(ad)` | しない（既存の `ad` を購読） | **しない** |

```tsx
import { useInterstitialAd } from 'expo-google-mobile-ads';

function Screen() {
  const { ad, isLoaded } = useInterstitialAd({
    adUnitId: 'ca-app-pub-3940256099942544/1033173712',
  });

  return <Button title="Show ad" disabled={!isLoaded} onPress={() => ad.show()} />;
}
```

プリロード済みの広告（上記の `interstitialAd` など）の状態を購読するだけなら、`useInterstitialAdState` / `useRewardedAdState` を使う——どちらも渡された `ad` の生成も release も行わない。呼び出し側が `ad` のライフタイムを管理する。

### 単発利用

フルスクリーン広告は一度しか表示できない。`show()` の後、`status` は `'shown'` になり、これは**終端状態**である——この状態の広告に `load()` を呼んでも何も起きない。両プラットフォームの SDK 自体もこれを独自に強制している（iOS は `AdAlreadyUsed`、Android は `AD_REUSED` を報告する）ため、回避する方法はない。次のインプレッションには `createInterstitialAd` / `createRewardedAd` で新しい広告を作ること。

### `show()`

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

### `ad.reward` は獲得した証拠ではない

`RewardedAd` の `reward` プロパティは、その広告が**提供するもの**である——ロードが終わり次第、まだ一度も表示されていない時点で読み取れる。これはプロンプトでユーザーに「何がもらえるか」を伝えるためのものだ。**これは報酬を獲得した証拠ではない。** 特に iOS では、この値は広告が表示される前の時点ですでに埋まっているため、その値が存在することだけをもって「ユーザーが広告を視聴した」とみなすと、表示直後に閉じたユーザーにも報酬を与えてしまう。

**報酬が獲得されたかどうかの唯一の正しい情報源は、`show()` が resolve する値である。** 報酬はそこで付与すること——`ad.reward` からは絶対に付与しないこと。

```typescript
const reward = await rewardedAd.show(); // AdReward | null
if (reward) {
  // `reward.amount` 個の `reward.type` を付与する
}
```

## メディエーション

このライブラリはメディエーションアダプタのバージョンを固定した「キュレート済みリスト」を持たない。アダプタのバージョンは頻繁に更新され、ライブラリ側で固定すると陳腐化する保守負債になるためである。代わりに config plugin に素の指定口を用意しており、必要な依存関係を自分で指定する。

以下の例は AppLovin を完全な実例として使っている — そのままコピーの出発点にできる、実在する Android のアーティファクト座標と iOS の pod バージョンである。

```json
{
  "expo": {
    "plugins": [
      [
        "expo-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxx~yyyy",
          "iosAppId": "ca-app-pub-xxxx~zzzz",
          "androidDependencies": [
            "com.google.ads.mediation:applovin:13.6.4.0"
          ],
          "androidMavenRepositories": [
            "https://artifact.bytedance.com/repository/pangle/"
          ],
          "iosPods": {
            "GoogleMobileAdsMediationAppLovin": "13.6.3.0"
          }
        }
      ]
    ]
  }
}
```

上の例で Android と iOS のバージョンが異なっているのは意図的である。両アダプタは独立にバージョニングされており、しばしば食い違う。**片方のプラットフォームの番号をもう片方に流用してはならない。** それぞれ自分の changelog から読むこと。

**changelog を読むときは「(In progress)」に注意する。** Google のアダプタ changelog は、まだリリースされていない*次の*バージョンを最上段に `(In progress)` 付きで載せている。一番上の番号をそのまま取ると存在しないバージョンを指すことになり、`pod install` や Gradle の解決に失敗する。`(In progress)` の見出しがある場合は、その*下*の最初のエントリを取ること。

**バージョンは動く — ここからコピーしたまま放置しないこと。** 各ネットワークの現在のバージョンは、追加する時点で下記の changelog から取得する。他のネットワークについては、下表のアーティファクト ID（Android）または pod 名（iOS）に、changelog が示す時点のバージョンを添えて追加する。

| ネットワーク | Android | iOS |
|---|---|---|
| AppLovin | `com.google.ads.mediation:applovin` ([changelog](https://developers.google.com/admob/android/mediation/applovin)) | `GoogleMobileAdsMediationAppLovin` ([changelog](https://developers.google.com/admob/ios/mediation/applovin)) |
| Pangle | `com.google.ads.mediation:pangle` ([changelog](https://developers.google.com/admob/android/mediation/pangle)) | `GoogleMobileAdsMediationPangle` ([changelog](https://developers.google.com/admob/ios/mediation/pangle)) |
| Unity Ads | `com.google.ads.mediation:unity` ([changelog](https://developers.google.com/admob/android/mediation/unity)) | `GoogleMobileAdsMediationUnity` ([changelog](https://developers.google.com/admob/ios/mediation/unity)) |
| ironSource | `com.google.ads.mediation:ironsource` ([changelog](https://developers.google.com/admob/android/mediation/ironsource)) | `GoogleMobileAdsMediationIronSource` ([changelog](https://developers.google.com/admob/ios/mediation/ironsource)) |
| LY Ads Network（旧 LINE Ads Network） | `com.google.ads.mediation:line` ([changelog](https://developers.google.com/admob/android/mediation/line)) | `GoogleMobileAdsMediationLine` ([changelog](https://developers.google.com/admob/ios/mediation/line)) |

`androidMavenRepositories` はネットワーク固有の Maven リポジトリ（例: Pangle）が必要な場合にのみ指定する。

## バナーの自動リフレッシュ

GMA のバナー自動リフレッシュは **AdMob 管理画面（広告ユニットの設定）側の機能であり、SDK の API ではない**。本ライブラリはこれに一切関与しない。リフレッシュ間隔を変更したい場合は AdMob の管理画面で設定する。

## API リファレンス

`src/index.ts` からエクスポートされるもの一覧:

```typescript
// バナー広告（命令型コア）
export function createBannerAd(options: BannerAdOptions): BannerAd;
export type { BannerAd, BannerAdOptions, BannerAdEvents };

// 表示 View
export function BannerAdView(props: BannerAdViewProps): JSX.Element;
export type { BannerAdViewProps };

// サイズユーティリティ
export const BannerAdSize: { ... };
export type { AdaptiveOptions, BannerAdAdaptiveKind, BannerAdSizeSpec, InlineAdaptiveOptions };

// 初期化
export function initialize(): Promise<InitializationStatus>;
export function setRequestConfiguration(config: RequestConfiguration): void;

// バナー hooks
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };
export function useBannerAdState(ad: BannerAd): BannerAdState;
export type { BannerAdState };
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize;

// インタースティシャル広告
export function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd;
export type { InterstitialAd, FullScreenAdEvents };

// リワード広告
export function createRewardedAd(options: FullScreenAdOptions): RewardedAd;
export type { RewardedAd, RewardedAdEvents };

// フルスクリーン広告（共通）
export class ShowAdError extends Error { code: ShowAdErrorCode; }
export type { FullScreenAdOptions };

// フルスクリーン広告 hooks
export function useInterstitialAd(options: FullScreenAdOptions): FullScreenAdState & { ad: InterstitialAd };
export function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState;
export type { FullScreenAdState };
export function useRewardedAd(options: FullScreenAdOptions): FullScreenAdState & { ad: RewardedAd };
export function useRewardedAdState(ad: RewardedAd): FullScreenAdState;

// 型
export type {
  AdError,
  AdReward,
  AdapterResponse,
  BannerAdStatus,
  FullScreenAdStatus,
  InitializationStatus,
  PaidEventValue,
  RequestConfiguration,
  RequestOptions,
  ResponseInfo,
  ShowAdErrorCode,
};
```

## ライセンス

MIT
