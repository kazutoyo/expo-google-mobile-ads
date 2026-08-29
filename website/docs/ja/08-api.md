---
title: "API"
description: "パッケージルートからエクスポートしているコンポーネント・hooks・クラス・関数・型の一覧です。"
---

```typescript
import { createBannerAd, BannerAdView, BannerAdSize } from '@kazutoyo/expo-google-mobile-ads';
```

以下はすべてパッケージルートからエクスポートしていて、iOS と Android の両方で動きます。プラットフォーム差がある項目には個別に記載しています。

## コンポーネント

### `BannerAdView`

型: `React.FC<BannerAdViewProps>`

バナー広告を表示します。マウント時にネイティブ View をアタッチし、アンマウント時は**広告を破棄せずにデタッチするだけ**なので、同じ広告を別の画面でもう一度表示できます。

サイズはロード後は `ad.loadedSize`、ロード前は `ad.size` から決まります。つまりリクエストしたサイズで領域を確保しておき、実際に配信された広告のサイズが違った場合だけ補正します。広告を直接購読しているので、hooks を使わずにプリロード済みの広告を描画していても、ロード完了時に再描画されます。

release 済みの広告は、例外を投げずにサイズ0の箱として描画されます。

#### `BannerAdViewProps`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `ad` | [`BannerAd`](#bannerad) | 表示する広告。[`createBannerAd()`](#createbanneradoptions) か [`useBannerAd()`](#usebanneradoptions) が返したもの。ロード前に渡しても問題ありません |
| `style`（任意） | `StyleProp<ViewStyle>` | 広告サイズから決まる width / height の上に適用されます |

## Hooks

### `useBannerAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`BannerAdOptions`](#banneradoptions) |

バナー広告を生成してロードを始め、**アンマウント時に release します**。広告のライフタイムが画面と一致する場合はこちらを使います。

`adUnitId` か `size` が変わると新しい広告を生成し、古いものは release します。`requestOptions` は生成時にしか読まないので、後から変えても効きません。

戻り値: [`BannerAdState`](#banneradstate) `& { ad: `[`BannerAd`](#bannerad)` }`

### `useBannerAdState(ad)`

| 引数 | 型 |
| --- | --- |
| `ad` | [`BannerAd`](#bannerad) |

既にある広告（[`createBannerAd()`](#createbanneradoptions) でプリロードしたものなど）を購読します。**生成も release もしません**。ライフタイムは呼び出し側が持ちます。

状態は広告インスタンスをキーにしているので、別の広告を渡すとリセットされます。前の広告の `isLoaded` や `error` を引きずりません。

戻り値: [`BannerAdState`](#banneradstate)

### `useBannerAdSize(spec)`

| 引数 | 型 |
| --- | --- |
| `spec` | [`BannerAdSizeSpec`](#banneradsizespec) |

画面幅や向きが変わったときにアダプティブサイズを計算し直します。`spec.orientation` が `'current'` のときは必ず使ってください。アンカー型のアダプティブサイズは、縦向きと横向きで解決される高さが変わるためです。

戻り値: [`BannerAdSize`](#banneradsize-1)

### `useInterstitialAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

インタースティシャル広告を生成してロードを始め、アンマウント時に release します。`requestOptions` は生成時にしか読みません。別の広告が欲しい場合は違う `adUnitId` で呼び直します。

戻り値: [`FullScreenAdState`](#fullscreenadstate) `& { ad: `[`InterstitialAd`](#interstitialad)` }`

### `useInterstitialAdState(ad)`

| 引数 | 型 |
| --- | --- |
| `ad` | [`InterstitialAd`](#interstitialad) |

呼び出し側が持っているインタースティシャル広告を購読します。生成も release もしません。[`useBannerAdState()`](#usebanneradstatead) と同じく広告インスタンスをキーにしています。

戻り値: [`FullScreenAdState`](#fullscreenadstate)

### `useRewardedAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

リワード広告を生成してロードを始め、アンマウント時に release します。

戻り値: [`FullScreenAdState`](#fullscreenadstate) `& { ad: `[`RewardedAd`](#rewardedad)` }`

### `useRewardedAdState(ad)`

| 引数 | 型 |
| --- | --- |
| `ad` | [`RewardedAd`](#rewardedad) |

呼び出し側が持っているリワード広告を購読します。生成も release もしません。

報告するのはロード状態だけです。その広告が提供する報酬は [`ad.reward`](#rewardedad) にあり、ユーザーが実際に獲得したかどうかは `show()` の解決値だけが持ちます。これを分けていることが、広告を閉じただけの人に報酬を渡してしまう事故を防ぎます。

戻り値: [`FullScreenAdState`](#fullscreenadstate)

### `useConsentInfo()`

SDK が最後に報告した同意情報を購読します。

**読み取り専用**で、呼んでも何もリクエストしません。[`gatherConsent()`](#gatherconsentoptions) などの同意関数が呼ばれるまで、各フィールドは「まだ何も分かっていない」状態の値を持ちます。

マウント時に SDK の永続化済み同意情報を取り込むことは**しません**。アプリを再起動すると、ネイティブ SDK が `'obtained'` を保持していても `status: 'unknown'` / `canRequestAds: false` を返します。そのため、この hook だけを見てプライバシーオプションのボタン表示を決める設定画面は、その起動中に同意関数を通っていない限り、再起動後は何も表示しなくなります。

戻り値: [`ConsentInfo`](#consentinfo)

## クラス

### `BannerAd`

型: `SharedObject<`[`BannerAdEvents`](#banneradevents)`>` を継承したクラス

バナー広告です。[`createBannerAd()`](#createbanneradoptions) か [`useBannerAd()`](#usebanneradoptions) が生成します。View からは独立しています。

#### プロパティ

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `size` | [`BannerAdSize`](#banneradsize-1) | 読み取り専用。リクエストしたサイズです。ロード前に領域を確保するために使います |
| `status` | [`BannerAdStatus`](#banneradstatus) | 読み取り専用。ライフサイクル上のどこにいるか |
| `error`（任意） | [`AdError`](#aderror) | 読み取り専用。`status` が `'error'` のときに入ります |
| `loadedSize`（任意） | [`BannerAdSize`](#banneradsize-1) | 読み取り専用。実際に配信された広告のサイズで、ロード後に読めます。`adaptiveKind` も引き継ぐので、そのまま `size` オプションに渡しても固定サイズに劣化しません |
| `responseInfo`（任意） | [`ResponseInfo`](#responseinfo) | 読み取り専用。どの広告ソースとメディエーションアダプタが配信したか |

#### メソッド

| メソッド | 戻り値 | 説明 |
| --- | --- | --- |
| `load()` | `void` | もう一度リクエストします。失敗後のリトライや手動リロードに使います |
| `release()` | `void` | ネイティブの広告を破棄します。`SharedObject` から継承。release した広告は二度とロードも表示もできません |
| `addListener(event, listener)` | `EventSubscription` | [`BannerAdEvents`](#banneradevents) のいずれかを購読します。`SharedObject` から継承 |

### `InterstitialAd`

型: `SharedObject<`[`FullScreenAdEvents`](#fullscreenadevents)`>` を継承したクラス

全画面のインタースティシャル広告です。**使い切り**で、`show()` の後は `status` が `'shown'` になります。これは終端状態で、そこから `load()` を呼んでも何も起きません。両プラットフォームの SDK 側も独自に再利用を拒否します（iOS は `AdAlreadyUsed`、Android は `AD_REUSED`）。次のインプレッションには新しい広告を作ってください。

#### プロパティ

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `status` | [`FullScreenAdStatus`](#fullscreenadstatus) | 読み取り専用 |
| `error`（任意） | [`AdError`](#aderror) | 読み取り専用。`status` が `'error'` のときに入ります |
| `responseInfo`（任意） | [`ResponseInfo`](#responseinfo) | 読み取り専用 |

#### メソッド

| メソッド | 戻り値 | 説明 |
| --- | --- | --- |
| `show()` | `Promise<void>` | 広告を表示し、ユーザーが閉じた時点で resolve します。[`ShowAdError`](#showaderror) で reject します。ロード中の広告を**あえて待ちません**。`isLoaded` を見て、準備できていなければその回は諦めてください |
| `load()` | `void` | もう一度リクエストします。`status` が `'shown'` になった後は何も起きません |
| `release()` | `void` | ネイティブの広告を破棄します |
| `addListener(event, listener)` | `EventSubscription` | [`FullScreenAdEvents`](#fullscreenadevents) のいずれかを購読します |

### `RewardedAd`

型: `SharedObject<`[`RewardedAdEvents`](#rewardedadevents)`>` を継承したクラス

全画面のリワード広告です。[`InterstitialAd`](#interstitialad) と同じく使い切りです。

#### プロパティ

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `reward`（任意） | [`AdReward`](#adreward) | 読み取り専用。その広告が**提供するもの**です。ロード直後から読めるので、「何がもらえるか」を先にユーザーへ提示できます。**獲得した証拠ではありません。** iOS では表示前からこの値が埋まっているため、値の存在をもって「視聴した」とみなすと、開いてすぐ閉じたユーザーにも報酬が出てしまいます |
| `status` | [`FullScreenAdStatus`](#fullscreenadstatus) | 読み取り専用 |
| `error`（任意） | [`AdError`](#aderror) | 読み取り専用 |
| `responseInfo`（任意） | [`ResponseInfo`](#responseinfo) | 読み取り専用 |

#### メソッド

| メソッド | 戻り値 | 説明 |
| --- | --- | --- |
| `show()` | `Promise<`[`AdReward`](#adreward)` \| null>` | 広告を表示します。ユーザーが獲得した報酬、獲得せずに閉じた場合は `null` で resolve します。**この解決値だけが報酬を獲得したかどうかの正しい情報源です。** 付与はここで行い、`ad.reward` からは行わないでください。[`ShowAdError`](#showaderror) で reject します |
| `load()` | `void` | もう一度リクエストします。`status` が `'shown'` になった後は何も起きません |
| `release()` | `void` | ネイティブの広告を破棄します |
| `addListener(event, listener)` | `EventSubscription` | [`RewardedAdEvents`](#rewardedadevents) のいずれかを購読します |

### `ShowAdError`

型: `Error` を継承したクラス

全画面広告の `show()` が投げます。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `code` | [`ShowAdErrorCode`](#showaderrorcode) | 3つの失敗のどれか |
| `cause`（任意） | `unknown` | `failedToShow` のとき、ネイティブ側が reject した元のエラー。SDK 自身のエラーへプログラムから触れるようにしてあります（iOS の `AdAlreadyUsed` と本当の表示失敗を区別したい場合など） |

### `ConsentError`

型: `Error` を継承したクラス

すべての同意関数が投げます。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `code` | [`ConsentErrorCode`](#consenterrorcode) | プラットフォーム間で正規化済み |
| `cause`（任意） | `unknown` | 元のネイティブエラー |

SDK 自身の数値コードは `message` の末尾に付けています。生の数値はプラットフォーム間で食い違うためです（コード `2` は iOS では `invalidAppID`、Android では `INTERNET_ERROR`）。

## 定数

### `BannerAdSize`

固定サイズと、アダプティブサイズのヘルパーを持つオブジェクトです。

#### 固定サイズ

| 定数 | サイズ (dp) | 備考 |
| --- | --- | --- |
| `BannerAdSize.BANNER` | 320×50 | |
| `BannerAdSize.LARGE_BANNER` | 320×100 | |
| `BannerAdSize.MEDIUM_RECTANGLE` | 300×250 | |
| `BannerAdSize.FULL_BANNER` | 468×60 | タブレット向け。スマートフォンではロードに成功したあと無言でクリップされます。エラーもダウンスケールもレイアウト警告も出ません |
| `BannerAdSize.LEADERBOARD` | 728×90 | タブレット向け。`FULL_BANNER` と同じくクリップされます |

#### `BannerAdSize.anchoredAdaptive(options?)`

| 引数 | 型 |
| --- | --- |
| `options`（任意） | [`AdaptiveOptions`](#adaptiveoptions) |

高さ 50〜90dp のアンカー型アダプティブサイズです。同期関数なので、ロードを待たずに表示領域を確保できます。

対応するネイティブ API は**両プラットフォームで非推奨**で、将来の SDK メジャーバージョンで削除される可能性があります。それでも残しているのは、`largeAnchoredAdaptive` より高さが低くレイアウトへの影響が小さいためです。意図して使う人に警告を出さないよう、TypeScript の `@deprecated` は付けていません。

戻り値: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.largeAnchoredAdaptive(options?)`

| 引数 | 型 |
| --- | --- |
| `options`（任意） | [`AdaptiveOptions`](#adaptiveoptions) |

`anchoredAdaptive` の後継で、高さ 50〜150dp です。縦向き画面の高さの20%以内に収まり、動画広告の需要が高いときのために大きめの領域を確保します。

戻り値: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.inlineAdaptive(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`InlineAdaptiveOptions`](#inlineadaptiveoptions) |

スクロールするコンテンツの中に置くためのインライン型アダプティブサイズで、`options.maxHeight` までの高さになります。

返る `height` は**最大値**であり、最終的な高さではありません。配信される広告はもっと低いことがあり、実際に届いたサイズは `ad.loadedSize` が持ちます。

`maxHeight` は必須で、既定値はありません。各 SDK の「最大高さなし」ヘルパーは、レイアウトとして確保しようのない値を返すためです（iOS はセンチネルの `0`、Android は画面の全高）。ここで既定値を選ぶと、呼び出し側が求めていない領域を勝手に確保することになります。

`orientation` オプションもありません。アンカー型と違い、インラインの最大高さ形式は両プラットフォームとも画面の向きに依存しないためです。

戻り値: [`BannerAdSize`](#banneradsize-1)

#### `BannerAdSize.resolve(spec)`

| 引数 | 型 |
| --- | --- |
| `spec` | [`BannerAdSizeSpec`](#banneradsizespec) |

spec オブジェクトを1回だけサイズに解決します。[`useBannerAdSize()`](#usebanneradsizespec) は、これに画面の向きの購読を足したものです。

戻り値: [`BannerAdSize`](#banneradsize-1)

## 関数

### `createBannerAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`BannerAdOptions`](#banneradoptions) |

バナー広告を生成してロードを始めます。View を必要としないので React の外から呼べます。モジュールスコープでも、アプリ起動時でも、画面遷移の前でも構いません。

SDK の初期化が終わっていない場合、ロードは終わるまでキューに積まれます。初期化が失敗した場合は、待ち続けるのではなく `status: 'error'` に移ります。

広告のライフタイムは呼び出し側が持つので、不要になったら `release()` を呼んでください。

戻り値: [`BannerAd`](#bannerad)

### `createInterstitialAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

インタースティシャル広告を生成してロードを始めます。使い切りなので、インプレッションごとに作り直してください。

戻り値: [`InterstitialAd`](#interstitialad)

### `createRewardedAd(options)`

| 引数 | 型 |
| --- | --- |
| `options` | [`FullScreenAdOptions`](#fullscreenadoptions) |

リワード広告を生成してロードを始めます。使い切りです。

戻り値: [`RewardedAd`](#rewardedad)

### `initialize()`

Google Mobile Ads SDK を初期化します。広告をロードする前に、アプリ起動時に一度だけ呼びます。

**このライブラリは自動では初期化しません。** UMP 同意との順序はアプリ側の判断です。この順序について Google 自身の案内は時期によって変わっていて、旧来は「同意が先」（`initialize()` がメディエーションアダプタによる広告プリロードを走らせるため）、現行は「初期化が先でよい」（初期化自体は個人データを扱わないため）としています。自動初期化してしまうと、この揺れている解釈の片方をライブラリがアプリに代わって選んだことになり、上書きもできません。

複数回呼んでも同じ Promise を返します。初期化に失敗した場合はキャッシュした Promise を破棄するので、後から呼び直してリトライできます。そのとき、待たされていた広告にも失敗が伝わります。

戻り値: `Promise<`[`InitializationStatus`](#initializationstatus)`>`

### `setRequestConfiguration(config)`

| 引数 | 型 |
| --- | --- |
| `config` | [`RequestConfiguration`](#requestconfiguration) |

すべての広告リクエストに適用される設定を行います。テストデバイス、児童向け設定、広告コンテンツの最大レーティングなどです。

戻り値: `void`

### `gatherConsent(options?)`

| 引数 | 型 |
| --- | --- |
| `options`（任意） | [`ConsentRequestOptions`](#consentrequestoptions) |

最新の同意情報を取得し、必要ならフォームも表示します。ネイティブ側の1回の呼び出しにまとまっています。ほとんどのアプリはこれだけで足ります。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`。[`ConsentError`](#consenterror) で reject します

### `requestConsentInfoUpdate(options?)`

| 引数 | 型 |
| --- | --- |
| `options`（任意） | [`ConsentRequestOptions`](#consentrequestoptions) |

最新の同意情報を取得しますが、フォームは**表示しません**。更新とフォーム表示のタイミングを分ける必要があるときだけ使ってください。分ける必要がなければ `gatherConsent()` が両方やります。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `showConsentFormIfRequired()`

`status` が `'required'` のときだけ同意フォームを表示し、そうでなければ何も表示せずに resolve します。事前に `requestConsentInfoUpdate()` が成功している必要があります。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `showPrivacyOptionsForm()`

プライバシーオプションのフォームを表示し、一度した選択を変えられるようにします。これを呼ぶ導線を置くのは、`privacyOptionsRequirement` が `'required'` のときだけにしてください。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `getConsentInfo()`

通信せずに現在の同意情報を読みます。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`

### `resetConsent()`

保存済みの同意を消して、フォームを再表示できる状態に戻します。

**開発ビルド限定**で、`__DEV__` が false のときは no-op です。同時に、デバイスを再テスト可能にする唯一の手段でもあります。SDK は同意を永続化するので、これを呼ばないとフローを通れるのは一度きりで、以降はアプリを入れ直すまでフォームが出ません。

戻り値: `Promise<`[`ConsentInfo`](#consentinfo)`>`

## 型

### `AdaptiveOptions`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `width`（任意） | `number` | dp 単位。既定は画面幅です |
| `orientation`（任意） | `'current' \| 'portrait' \| 'landscape'` | 既定は `'current'`（呼び出し時点の向き） |

### `AdError`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `code` | `number` | SDK 自身のエラーコード |
| `message` | `string` | |
| `domain` | `string` | どの SDK 層が投げたか |
| `responseInfo`（任意） | [`ResponseInfo`](#responseinfo) | レスポンス情報付きで失敗が返ってきた場合に入ります |

### `AdReward`

リワード広告でユーザーが獲得したものです。

| プロパティ | 型 |
| --- | --- |
| `type` | `string` |
| `amount` | `number` |

### `AdapterResponse`

1つのメディエーションアダプタがリクエストに対して行ったことです。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `adapterClassName` | `string` | |
| `latencyMillis` | `number` | このアダプタにかかった時間 |
| `adError`（任意） | `{ code: number; message: string; domain: string }` | このアダプタが埋められなかった理由 |

### `BannerAdAdaptiveKind`

リテラル型: `'anchored' \| 'anchoredPortrait' \| 'anchoredLandscape' \| 'largeAnchored' \| 'largeAnchoredPortrait' \| 'largeAnchoredLandscape' \| 'inline'`

サイズがアダプティブであることと、どの系統かを表すマーカーです。

両ネイティブ SDK は「アダプティブ」を width/height ではなく、広告サイズ型のフラグとして表しています（iOS は `GADAdSize.flags`、Android は `AdSize.isAnchoredAdaptiveBanner` / `isInlineAdaptiveBanner` / `isLargeAnchoredAdaptiveBanner`）。そのため2つの数値だけからは復元できません。**アダプティブサイズを丸ごと渡さなければならないのはこのためです。** `width` と `height` から作り直すとマーカーが落ち、ネイティブ側はその高さちょうどの固定バナーをリクエストします。エラーは出ないので気づけません。

向きを別フィールドにせずマーカーに畳み込んでいるのは、アンカー型のサイズが向きで実際に変わるためです。実機で測ると `largeAnchored` は 338×106、`largeAnchoredLandscape` は 338×80 です。

### `BannerAdEvents`

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `statusChange` | `{ status: `[`BannerAdStatus`](#banneradstatus)`; error?: `[`AdError`](#aderror)` }` | ライフサイクルが進んだ |
| `impression` | — | インプレッションが記録された |
| `clicked` | — | 広告がタップされた |
| `paid` | [`PaidEventValue`](#paideventvalue) | このインプレッションに収益が割り当てられた |

### `BannerAdOptions`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `adUnitId` | `string` | AdMob の広告ユニット ID。スラッシュ区切り（`ca-app-pub-xxxx/yyyy`） |
| `size` | [`BannerAdSize`](#banneradsize-1) | 固定サイズの定数か、アダプティブヘルパーの戻り値 |
| `requestOptions`（任意） | [`RequestOptions`](#requestoptions) | リクエスト単位のターゲティング |

### `BannerAdSize`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `width` | `number` | 読み取り専用。dp 単位 |
| `height` | `number` | 読み取り専用。dp 単位。`inline` のアダプティブサイズでは固定値ではなく**最大**の高さです |
| `adaptiveKind`（任意） | [`BannerAdAdaptiveKind`](#banneradadaptivekind) | 読み取り専用。3つのアダプティブヘルパーが付けます。固定サイズにはありません |

### `BannerAdSizeSpec`

リテラル型: `union`

[`useBannerAdSize()`](#usebanneradsizespec) が計算し直せるよう、アダプティブサイズを記述したものです。

取りうる値: `{ type: 'anchoredAdaptive' } &` [`AdaptiveOptions`](#adaptiveoptions) `|` `{ type: 'largeAnchoredAdaptive' } &` [`AdaptiveOptions`](#adaptiveoptions) `|` `{ type: 'inlineAdaptive' } &` [`InlineAdaptiveOptions`](#inlineadaptiveoptions)

### `BannerAdState`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `isLoaded` | `boolean` | |
| `error`（任意） | [`AdError`](#aderror) | |
| `loadedSize`（任意） | [`BannerAdSize`](#banneradsize-1) | 実際に配信された広告のサイズ |

release 済みの広告は例外ではなく `{ isLoaded: false }` を返します。release した直後の広告をまだ描画しているコンポーネントがクラッシュしないためです。

### `BannerAdStatus`

リテラル型: `'loading' \| 'loaded' \| 'error'`

### `ConsentErrorCode`

リテラル型: `string`

同意呼び出しが失敗した理由です。ネイティブ側で正規化しています。

| コード | 意味 |
| --- | --- |
| `network` | 同意サーバーとの通信エラー |
| `timeout` | リクエストがタイムアウトした |
| `invalidOperation` | 呼び出し順序の誤り（更新前にフォームを表示しようとしたなど） |
| `misconfiguration` | **iOS 限定。** App ID か、AdMob コンソール側の UMP 設定が誤っている |
| `formUnavailable` | **iOS 限定。** このユーザー向けの同意フォームを読み込めなかった |
| `internal` | SDK 内部エラー。Android ではアプリの React context が破棄された場合も含みます |
| `noActivity` | **Android 限定。** SDK ではなくこのライブラリが出すもので、フォアグラウンドに Activity がない状態で呼び出しが到達したことを表します |
| `unknown` | ネイティブ側から認識可能なコードが送られてこなかった |

Android の UMP には `misconfiguration` や `formUnavailable` に相当するコードがなく、それらの状況を `internal` か `invalidOperation` として報告します。

### `ConsentInfo`

`Readonly` — UMP が現時点で把握している内容のスナップショットです。すべての同意関数がこれで resolve します。公開されるスナップショットは、すべての `useConsentInfo()` 購読者と共有されるため凍結されています。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `status` | [`ConsentStatus`](#consentstatus) | UMP 自身の同意ステータス |
| `canRequestAds` | `boolean` | 今すぐ広告をリクエストしてよいか。**判定は `status` ではなくこちらで行ってください。** 同意が不要なユーザーも、配信に最低限必要な範囲だけ同意したユーザーも、すでに `true` になります |
| `isConsentFormAvailable` | `boolean` | 現時点でフォームを表示できるか。iOS は3値（`UMPFormStatus`）、Android は boolean を返すので、両方が表現できる boolean に丸めています。iOS の `unknown` は `false` になります。アプリ側の対応は「unknown」と「unavailable」で変わらないためです |
| `privacyOptionsRequirement` | [`PrivacyOptionsRequirementStatus`](#privacyoptionsrequirementstatus) | 自前のプライバシーオプション導線は、これが `'required'` のときだけ表示します |

この4つは、ユーザーが**どの選択肢**を選んだかでは変化しません。同意が必要か、広告をリクエストできるかを表すもので、何を選んだかは持っていません。

### `ConsentRequestOptions`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `tagForUnderAgeOfConsent`（任意） | `boolean` | UMP 独自のフラグで、広告リクエスト時に GMA が使う [`RequestConfiguration.tagForUnderAgeOfConsent`](#requestconfiguration) とは**別物**です。片方を設定しても、もう片方は設定されません。両方に該当するなら両方に渡してください |
| `debugSettings.testDeviceIds`（任意） | `string[]` | iOS は identifier for vendor、Android はハッシュ化されたデバイス ID を取ります。両 SDK とも、最初の同意リクエスト時にそのデバイスに必要な値をコンソール／logcat に出力するので、まず指定なしで一度実行して、ログから ID をコピーしてください |
| `debugSettings.geography`（任意） | [`DebugGeography`](#debuggeography) | 疑似的に設定する地域 |

`debugSettings` はデバッグビルドの、しかも指定したデバイスでのみ効きます。

### `ConsentStatus`

リテラル型: `'unknown' \| 'required' \| 'notRequired' \| 'obtained'`

ユーザーの同意が必要か、そして取得済みかを表します。両プラットフォームで UMP 自身の enum に対応しています。

`'unknown'` は `requestConsentInfoUpdate()` が一度も成功していない状態です。エラーではなく、まだ何も尋ねていないという意味です。

### `DebugGeography`

リテラル型: `'disabled' \| 'eea' \| 'regulatedUsState' \| 'other'`

同意フローをテストするために、SDK にどの地域のデバイスとして振る舞わせるかを指定します。`ConsentRequestOptions.debugSettings.testDeviceIds` に挙げたデバイスにのみ適用され、それ以外のデバイスでは両プラットフォームとも無視されます。

### `FullScreenAdEvents`

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `statusChange` | `{ status: `[`FullScreenAdStatus`](#fullscreenadstatus)`; error?: `[`AdError`](#aderror)` }` | |
| `showed` | — | 広告が表示された |
| `dismissed` | — | ユーザーが広告を閉じた |
| `impression` | — | |
| `clicked` | — | |
| `paid` | [`PaidEventValue`](#paideventvalue) | |

### `FullScreenAdOptions`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `adUnitId` | `string` | |
| `requestOptions`（任意） | [`RequestOptions`](#requestoptions) | |

### `FullScreenAdState`

| プロパティ | 型 |
| --- | --- |
| `isLoaded` | `boolean` |
| `error`（任意） | [`AdError`](#aderror) |

### `FullScreenAdStatus`

リテラル型: `'loading' \| 'loaded' \| 'shown' \| 'error'`

`'shown'` は**終端状態**です。この広告は両 SDK とも一度きりのものなので、表示済みの広告が再ロードされることはありません。新しく作り直してください。

### `InitializationStatus`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `adapterStatuses` | `Record<string, { state: 'ready' \| 'notReady'; description: string; latency: number }>` | メディエーションアダプタごとに1エントリ。キーはクラス名です |

### `InlineAdaptiveOptions`

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `width`（任意） | `number` | dp 単位。既定は画面幅です |
| `maxHeight` | `number` | 最大の高さ（dp）。最低32dp、50dp 以上を推奨します。必須である理由は [`inlineAdaptive()`](#banneradsizeinlineadaptiveoptions) を参照してください |

### `PaidEventValue`

1インプレッションに割り当てられた収益です。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `value` | `number` | |
| `currencyCode` | `string` | |
| `precision` | `'unknown' \| 'estimated' \| 'publisherProvided' \| 'precise'` | `value` がどれくらい正確か |

### `PrivacyOptionsRequirementStatus`

リテラル型: `'unknown' \| 'required' \| 'notRequired'`

アプリが自前の設定画面にプライバシーオプションの導線を用意する必要があるかどうかです。導線を出すのはこれが `'required'` のときだけにして、[`showPrivacyOptionsForm()`](#showprivacyoptionsform) で開きます。

### `RequestConfiguration`

すべての広告リクエストに適用されます。[`setRequestConfiguration()`](#setrequestconfigurationconfig) で設定します。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `testDeviceIds`（任意） | `string[]` | テスト広告を受け取るデバイス |
| `tagForChildDirectedTreatment`（任意） | `boolean` | |
| `tagForUnderAgeOfConsent`（任意） | `boolean` | GMA 側のフラグで、[`ConsentRequestOptions`](#consentrequestoptions) の UMP 側のものとは別です |
| `maxAdContentRating`（任意） | `'G' \| 'PG' \| 'T' \| 'MA'` | |

### `RequestOptions`

広告の生成時に渡す、リクエスト単位のターゲティングです。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `keywords`（任意） | `string[]` | |
| `contentUrl`（任意） | `string` | 広告と並んで表示されるコンテンツの URL |

### `ResponseInfo`

どの広告ソースがリクエストを埋めたかを表します。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `responseId`（任意） | `string` | |
| `mediationAdapterClassName`（任意） | `string` | 落札したアダプタ |
| `adSourceName`（任意） | `string` | |
| `adapterResponses` | [`AdapterResponse[]`](#adapterresponse) | 試行されたすべてのアダプタ（順番どおり） |

### `RewardedAdEvents`

[`FullScreenAdEvents`](#fullscreenadevents) のすべてに加えて、次のイベントがあります。

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `earnedReward` | [`AdReward`](#adreward) | ユーザーが報酬を獲得した。計測目的でなければ、付与はこのイベントではなく `show()` の解決値から行ってください |

### `ShowAdErrorCode`

リテラル型: `'notLoaded' \| 'alreadyShown' \| 'failedToShow'`

| コード | 意味 |
| --- | --- |
| `notLoaded` | 広告の準備ができていません。`show()` の前に `isLoaded` を確認してください。release 済みの広告もこれになります。二度と表示できませんが、release したこと自体は「表示済みかどうか」とは無関係なので `alreadyShown` ではありません |
| `alreadyShown` | この広告の `status` はすでに `'shown'` です |
| `failedToShow` | SDK 自体が表示を拒否しました。`cause` に SDK 自身のエラーが入ります |

`notLoaded` と `alreadyShown` は、SDK に到達する前に広告自身の `status` から判定しています。Android の Next-Gen SDK には準備状態を問い合わせる API が一切ないので、こちら側で判定することが両プラットフォームの挙動を揃える唯一の方法です。
