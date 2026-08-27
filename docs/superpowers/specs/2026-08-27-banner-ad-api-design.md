# expo-google-mobile-ads: バナー広告 API 設計

作成日: 2026-08-27
ステータス: 設計合意済み / 実装計画待ち

## 1. 目的

Expo Modules ネイティブな Google Mobile Ads (AdMob) ライブラリを新規に作る。既存の
`react-native-google-mobile-ads` は React Native 向けで TurboModules への移行途上にあり、
その構造的な制約（プリロード不可、アーキテクチャ移行の中途半端さ）を引き継ぎたくない。

本ドキュメントは **フェーズ1: バナー広告** の設計を扱う。

### 達成したいこと

1. **プリロード対応** — UI にアタッチする前に広告をロードできる。React のマウント前・画面遷移前に
   ロードを開始し、表示時には即座に出せる状態にする。
2. **hooks ベースの API** — React から自然に使える。
3. **バナーサイズ計算ユーティリティ** — `largeAnchoredAdaptive` などのサイズをロード前に確定させ、
   レイアウトシフトを防ぐ。
4. **New Architecture 専用** — 移行互換のための複雑さを持ち込まない。

## 2. スコープ

### 含む（フェーズ1）

- バナー広告のロード・表示・再利用
- SDK 初期化と設定（config plugin 含む）
- バナーサイズユーティリティ
- メディエーションアダプタを組み込むための仕組み

### 含まない

| 項目 | 理由 |
|---|---|
| UMP（同意管理） | フェーズ2で別途設計する。本設計は UMP と共存できる形（明示的 `initialize()`、暗黙初期化なし）を保証するに留める |
| インタースティシャル / リワード / アプリ起動時 / ネイティブ広告 | フェーズ3。本設計の「命令型コア + hooks」パターンを横展開する |
| ATT（トラッキング許可） | `expo-tracking-transparency` が既にある。再実装しない |
| Old Architecture 対応 | 対象外 |
| ネイティブ層の自動テスト | 実広告配信が絡み CI で安定させるコストが見合わない。example アプリ + 手動QAで担保 |

## 3. 技術選定

### パッケージ

- npm パッケージ名: `expo-google-mobile-ads`
- Expo Module 名: `ExpoGoogleMobileAds`
- 対象: Expo SDK 54 以降 / New Architecture 専用（開発は SDK 57 で行う）
- Android: minSdk 24, compileSdk 35, Kotlin 1.9+
- iOS: Expo SDK の要件に従う（iOS 15.1+）

### ネイティブ SDK

| プラットフォーム | SDK |
|---|---|
| Android | **GMA Next-Gen SDK** (`com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk`) |
| iOS | Google Mobile Ads SDK v13 系 |

Android で Next-Gen SDK を選ぶ理由:

- 新規ライブラリであり、レガシー SDK はメンテナンスモードに入っている
- `AdView.registerBannerAd(bannerAd, activity)` / `AdView.unregisterBannerAd()` の対があり、
  **「ロード済みの広告を View に流し込む / 破棄せずに取り外す」が SDK レベルでサポートされている**。
  本ライブラリの「アタッチ/デタッチして画面をまたいで再利用する」要件と正面から噛み合う
- 利用予定のメディエーション5社（AppLovin / Pangle / Unity Ads / ironSource / LY Ads Network）は
  すべて Next-Gen SDK でバナーを含む全フォーマットに対応済み（確認済み）

### Android の広告ロード方式

Next-Gen SDK では `BannerAd.load()`（View 不要の静的ロード）と `BannerAd.getView(activity)` が
**いずれも非推奨**である。View に付けずにロードする手段として以下を検討した。

| 方式 | 評価 |
|---|---|
| **1. AdView を画面外で保持（採用）** | SharedObject が `AdView` ごと所有し、window 未アタッチのまま `loadAd()` する。表示時は Expo の View に `addView` するだけ。非推奨 API を使わず、handle 1つ = 広告1つで本設計と完全に一致する |
| 2. `BannerAd.load()` | 非推奨だが動作する。フォールバック候補として保持 |
| 3. `BannerAdPreloader` | Google 公式のプリロード API でバッファ自動補充・リトライ付き。ただし「preloadId ごとのプールから `pollAd()` する」モデルであり、`createBannerAd()` が広告1つを返す本設計とは形が合わない。また iOS に対応物が無く API が非対称になる |

**方式1 の前提「window 未アタッチの `AdView` で `loadAd()` が成功するか」は検証済み（Task 0 スパイク）。**

エミュレータ（API 36）で、Activity に一切 `addView` しない `AdView` に対し
`MobileAds.initialize()` 完了後（バックグラウンドスレッドで実行）に `loadAd()` を呼んだところ、
テスト広告ユニット `ca-app-pub-3940256099942544/9214589741` で以下のコールバックを観測した。

```
D SPIKE: MobileAds.initialize completed
D SPIKE: OK: loaded off-window, size=360x113_as
```

さらに、ロード完了から5秒後（window 未アタッチのまま）に同じ `AdView` インスタンスを
`activity.addContentView()` で初めて画面に追加したところ、追加ロードや再ロードなしに
バナー（"AdMob Adaptive Banner" のテスト広告）が正しく描画されることを目視で確認した。
ロード成功後に描画が空白になる、といった劣化は見られなかった。

この結果により、方式1（採用）で Task 6 のネイティブ実装を進めてよいことが確定した。

方式3 は将来「リスト内に多数のバナーを出す」ユースケースが出てきた際に、別 API として追加を
検討する余地がある（本フェーズのスコープ外）。

### Expo Modules SharedObject

ネイティブの広告インスタンスは **SharedObject** として JS に公開する。

SharedObject は Expo Modules API の機能で、ネイティブの長命インスタンスを JS のクラスとして直接
公開し、JS・ネイティブ双方から参照されなくなった時点で自動解放される。`expo-video` が
`VideoPlayer` / `<VideoView player={player} />` で同型の課題（プレイヤー実体と表示 View の分離）を
解いており、実績のあるパターンである。

これにより **ID 採番とネイティブ側 Repository（Map 保持）を自前実装する必要がない**。
ライフサイクル管理と GC 連動を Expo Modules に任せられる。

命名も Expo の流儀（`VideoPlayer`, `AudioPlayer`, `SQLiteDatabase`）に合わせ、`Handle` のような
間接的な名前ではなく **オブジェクトそのもの** を返す。

## 4. アーキテクチャ

### 層の責務

| 層 | 責務 |
|---|---|
| ネイティブ `BannerAd` (SharedObject) | 広告のロード・保持・View のアタッチ/デタッチ・解放 |
| JS `BannerAd` クラス | SharedObject の JS 側表現。状態とイベントを持つ。**React 非依存** |
| `useBannerAd` / `BannerAdView` | 上記の薄い React バインディング |

React 非依存の命令型コアを土台に置くことで、アプリ起動時など React の外からプリロードできる。
hooks はその上の薄いラッパーに過ぎない。

### 広告の生存期間と View の関係

- `createBannerAd()` した時点でロードが始まる。View は不要
- `<BannerAdView ad={ad} />` はマウント時にネイティブ View をアタッチし、
  **アンマウント時はデタッチのみ**（破棄しない）
- したがって **画面遷移をまたいだ広告の再利用が可能**
- 破棄は `ad.release()` の明示呼び出し、または参照が切れた際の自動解放による

## 5. JS API 仕様

### 5.1 BannerAd（命令型コア）

```typescript
function createBannerAd(options: BannerAdOptions): BannerAd;

type BannerAdOptions = {
  adUnitId: string;
  size: BannerAdSize;
  requestOptions?: RequestOptions;
};

type RequestOptions = {
  keywords?: string[];
  contentUrl?: string;
};

class BannerAd {
  readonly size: BannerAdSize;              // リクエストしたサイズ
  readonly status: 'loading' | 'loaded' | 'error';
  readonly error?: AdError;
  readonly loadedSize?: BannerAdSize;       // 実際に返ってきたサイズ
  readonly responseInfo?: ResponseInfo;

  load(): void;                             // 失敗後のリトライ / 手動リロード
  release(): void;                          // 即時解放
  addListener<E extends BannerAdEventName>(
    event: E,
    listener: (payload: BannerAdEventPayload[E]) => void
  ): Subscription;
}

type BannerAdEventName = 'statusChange' | 'impression' | 'clicked' | 'paid';

type BannerAdEventPayload = {
  statusChange: { status: 'loading' | 'loaded' | 'error'; error?: AdError };
  impression: void;
  clicked: void;
  paid: PaidEventValue;
};

type PaidEventValue = {
  value: number;
  currencyCode: string;
  precision: 'unknown' | 'estimated' | 'publisherProvided' | 'precise';
};
```

初期状態は `'loading'`（生成時にロードが始まるため）。

**`networkExtras`（メディエーションアダプタ固有のパラメータ）は当初 `RequestOptions` に含めていたが、
実装時に取り下げた。** 各ネットワークのアダプタ固有クラスなしには汎用的な実装ができず、型に残したまま
ネイティブ側が黙って無視する状態は「型で約束して何もしない」罠になる。フィールドを後から追加するのは
破壊的変更ではないため、削除のコストはゼロで罠だけが消える。アダプタ固有 extras はメディエーション
対応タスクで実装する。

### 5.2 イベント

| イベント名 | ペイロード | 発火タイミング |
|---|---|---|
| `statusChange` | `{ status, error? }` | 状態が変化したとき（ロード成功・失敗を含む） |
| `impression` | なし | インプレッション計測時 |
| `clicked` | なし | クリック時 |
| `paid` | `PaidEventValue` | 収益発生時（LTV計測用） |

イベントは SharedObject が EventEmitter を備えているため、その仕組みに乗る。

`loaded` / `error` を個別イベントに**しない**理由: `expo` の `useEvent(emitter, eventName, initial)`
は「1つのイベントの引数を state として返す」形をしており、状態を1つの `statusChange` イベントに
集約すると hooks 実装が `useEvent` そのものになる（5.3 参照）。`loaded` と `statusChange` を
併存させると同じ事実の情報源が2つになり、利用者がどちらを使うべきか迷う。

ロード完了時に副作用を起こしたい場合は次のように書く。

```typescript
useEventListener(ad, 'statusChange', ({ status }) => {
  if (status === 'loaded') { /* ... */ }
});
```

**`BannerAdView` にはイベントハンドラの props を置かない。** ロードは View と無関係に起きる、
というこのライブラリの中心概念を API の形でも一貫させるため、イベント購読は `ad` 側に一本化する。

### 5.3 hooks

```typescript
// 生成する（アンマウント時に自動 release）
function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };

// 既存の ad を購読する（プリロード済みを画面で使う）。release はしない
function useBannerAdState(ad: BannerAd): BannerAdState;

type BannerAdState = {
  isLoaded: boolean;
  error?: AdError;
  loadedSize?: BannerAdSize;
};
```

**当初はオーバーロードで1つの名前に統一する設計だったが、実装時に取り下げた。**
2つの形は消費するフックの数が異なるため、公開関数で引数の型により分岐するとフックの条件付き
呼び出しになる。呼び出し側が引数の種類を途中で変えた場合、React のフック数不変条件で例外に
なる（顕在化する失敗）か、フックのスロットがずれて `useReleasingSharedObject` のクリーンアップが
脱落しネイティブの広告がリークする（沈黙する失敗）。影響は呼び出し側のそれ以降のフックにも及ぶ。
JSDoc の但し書きで支えられる種類の危険ではないと判断した。

2つの公開フックに分けることで、この条件付き呼び出しが消え、誤用は実行時のフック順序違反ではなく
呼び出し箇所の型エラーになる。生成する側が主名称 `useBannerAd` を持つのは `expo-video` の
`useVideoPlayer` に合わせたもので、本設計が範とした先例と一致する。

形1は `expo` の `useEvent` の薄いラッパーとして実装し、イベント購読と再レンダリング連動を
自前で書かない。実質的に次の1行になる。

```typescript
const { status, error } = useEvent(ad, 'statusChange', { status: ad.status, error: ad.error });
```

形2は `expo-modules-core` の `useReleasingSharedObject(factory, deps)` を使う。
これは「SharedObject を生成し、アンマウント時に自動 release する」hook であり、
`expo-video` の `useVideoPlayer` と同じ仕組みである。自動解放のロジックを自前で書かない。

```typescript
const ad = useReleasingSharedObject(
  () => new NativeModule.BannerAd(options),
  [options.adUnitId, options.size.width, options.size.height]
);
```

### 5.4 BannerAdView

```tsx
<BannerAdView ad={ad} style={...} />
```

- 未ロードの `ad` を渡してよい（ロード完了時に自動で表示される）
- サイズは `ad.size`（ロード前）/ `ad.loadedSize`（ロード後）から**自動的に領域を予約**する。
  `style` で上書き可能
- アンマウント時はデタッチのみ。`release()` は呼ばない
- 同一の `ad` を複数の `BannerAdView` に同時に渡した場合は**後勝ち**とし、`__DEV__` で警告する

### 5.5 自動リフレッシュについて

GMA のバナー自動リフレッシュは AdMob 管理画面側の設定であり SDK API ではない。
本ライブラリは関与しない（ドキュメントに明記する）。

## 6. BannerAdSize ユーティリティ

```typescript
type BannerAdSize = {
  readonly width: number;   // dp
  readonly height: number;  // dp
};

// 固定サイズ
BannerAdSize.BANNER;            // 320x50
BannerAdSize.LARGE_BANNER;      // 320x100
BannerAdSize.MEDIUM_RECTANGLE;  // 300x250
BannerAdSize.FULL_BANNER;       // 468x60
BannerAdSize.LEADERBOARD;       // 728x90

type AdaptiveOptions = {
  width?: number;                                       // 省略時は画面幅
  orientation?: 'current' | 'portrait' | 'landscape';   // 既定 'current'
};

BannerAdSize.anchoredAdaptive(options?: AdaptiveOptions): BannerAdSize;
BannerAdSize.largeAnchoredAdaptive(options?: AdaptiveOptions): BannerAdSize;
BannerAdSize.inlineAdaptive(options: AdaptiveOptions & { maxHeight?: number }): BannerAdSize;
```

### ネイティブ API の対応

| JS | Android (Next-Gen) | iOS (v13) |
|---|---|---|
| `anchoredAdaptive` | `AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(ctx, width)` | `currentOrientationAnchoredAdaptiveBanner(width:)` |
| `largeAnchoredAdaptive` | `AdSize.getLargeAnchoredAdaptiveBannerAdSize(ctx, width)` | `largeAnchoredAdaptiveBanner(width:)` |
| `inlineAdaptive` | `AdSize.getInlineAdaptiveBannerAdSize(width, maxHeight)` | `inlineAdaptiveBanner(width:maxHeight:)` |

`portrait` / `landscape` は各 API の対応するバリアントを呼ぶ。

### 同期関数にする理由

高さの最適化ロジックは Google が公開していないため、JS 側で式を再実装すると推測になる。
計算は AdMob のメソッドに任せ、返ってきた `AdSize` / `GADAdSize` から dp を読んで JS に返す。

この呼び出しはディスプレイメトリクスを参照するだけで I/O を伴わないため、Expo Modules の
同期関数（JSI）として公開する。これにより **ロード完了を待たずにレイアウト領域を確定でき、
広告表示時のレイアウトシフトが起きない**。

### 従来版アンカー型アダプティブの扱い

両 OS で従来版（`anchoredAdaptive`）は **非推奨だが削除はされていない**（確認済み）。

| API | 高さ |
|---|---|
| `anchoredAdaptive` | 50〜90dp |
| `largeAnchoredAdaptive` | 50〜150dp（ポートレート高さの20%以内、動画需要向け） |

Large は従来版より大幅に高く、レイアウトへの影響が大きいため、**両方を提供する**。

`anchoredAdaptive` には **TypeScript の `@deprecated` を付けない**。意図して使う利用者の
エディタに警告を出しても邪魔になるだけである。代わりにドキュメントで「対応するネイティブ API は
非推奨であり、将来の SDK メジャーで削除される可能性がある」と明記する。
`largeAnchoredAdaptive` と名前が完全に分離しているため、削除時は関数ごと消せばよい。

### 向きの変化への追従

```typescript
type BannerAdSizeSpec =
  | ({ type: 'anchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'largeAnchoredAdaptive' } & AdaptiveOptions)
  | ({ type: 'inlineAdaptive'; maxHeight?: number } & AdaptiveOptions);

function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize;
```

`useWindowDimensions` を購読し、回転時に再計算する。`orientation: 'current'` は呼んだ瞬間の
スナップショットのため、回転を考慮する画面ではこの hook を使う。

なお `BannerAdSize` は型と名前空間の両方として公開する（TypeScript の declaration merging）。
`BannerAdSize.BANNER` のような定数アクセスと、`size: BannerAdSize` のような型注釈が
同じ名前で書けるようにするため。

## 7. 初期化と設定

### 7.1 App ID の非対称性

| プラットフォーム | App ID の渡し方 |
|---|---|
| Android (Next-Gen) | `InitializationConfig.Builder(appId)` で**プログラム的に**渡す。マニフェストの meta-data は UMP 用にのみ必要 |
| iOS (v13) | `Info.plist` の `GADApplicationIdentifier`（無いとクラッシュ） |

この非対称性は **ライブラリ内部に隠蔽する**。JS 側は両 OS 同じ `initialize()` だけで済ませる。

### 7.2 config plugin

```json
["expo-google-mobile-ads", {
  "androidAppId": "ca-app-pub-xxxx~yyyy",
  "iosAppId": "ca-app-pub-xxxx~zzzz",
  "delayAppMeasurementInit": true
}]
```

plugin の責務:

1. iOS: `Info.plist` に `GADApplicationIdentifier` を書く
2. Android: `AndroidManifest.xml` に meta-data を書く（UMP 用 / フェーズ2への布石）
3. Android: App ID をネイティブコードから読める形で埋め込む
4. **ビルド時に App ID の存在と形式を検証し、不正なら明快なメッセージでビルドを失敗させる**

4 が重要である。App ID 未設定のまま初期化すると Google SDK は iOS でクラッシュ、Android で
`UninitializedPropertyAccessException` を投げるという分かりにくい壊れ方をする。

### 7.3 初期化 API

```typescript
GoogleMobileAds.initialize(): Promise<InitializationStatus>;

GoogleMobileAds.setRequestConfiguration(config: {
  testDeviceIds?: string[];
  tagForChildDirectedTreatment?: boolean;
  tagForUnderAgeOfConsent?: boolean;
  maxAdContentRating?: 'G' | 'PG' | 'T' | 'MA';
}): void;

type InitializationStatus = {
  adapterStatuses: Record<string, {
    state: 'ready' | 'notReady';
    description: string;
    latency: number;
  }>;
};
```

初期化は **JS からの明示呼び出しのみ**とし、ネイティブ側の自動初期化（Application / AppDelegate
での起動時初期化）や、初回広告生成時の遅延自動初期化は行わない。

### なぜ明示呼び出しか

**初期化と UMP 同意取得の順序について、Google の案内が割れているため。**

| 情報源 | 主張 |
|---|---|
| 旧来の案内（`react-native-google-mobile-ads` のドキュメントもこれに準拠） | 同意取得が先。`initialize()` はメディエーションアダプタによる広告プリロードを引き起こすため |
| Google の現行案内 | 初期化が先でよい。初期化自体は個人データを処理しない。`canRequestAds()` が true になるまで広告をリクエストしなければポリシー準拠 |

この順序は方針が動いている領域である。ネイティブ側で自動初期化すると、**揺れている解釈のどちらか
一方をライブラリに焼き込むことになり、アプリ側から変更できなくなる**。GDPR 絡みでアプリごとに
法務判断が異なりうる部分の制御権を、ライブラリが奪ってはならない。

明示呼び出しであれば、Google の案内が変わってもアプリ側が呼ぶ順序を変えるだけで済み、
ライブラリの更新を待つ必要がない。

なお `react-native-google-mobile-ads` も明示呼び出し（`mobileAds().initialize()`）であり、
エコシステムの期待にも沿う。

### パフォーマンス面のトレードオフ

ネイティブ自動初期化のほうが JS バンドルのロードを待たない分、初期化を数百 ms 早く開始できる。
これを捨てる判断である。

本ライブラリの主眼であるバナーのプリロードは結局初期化完了に依存し、かつ 7.4 のキュー機構により
「JS 側で早めに `createBannerAd()` を呼べば初期化の待ち時間と重なる」構造になっている。
得られる数百 ms と引き換えに同意フローの制御権を失うのは割に合わない。

### 7.4 Next-Gen SDK の制約への対応

Next-Gen SDK には2つの制約があり、いずれもライブラリ側で吸収する。

**制約1: バックグラウンドスレッドで呼ぶ必要がある**（メインスレッドで呼ぶと ANR の恐れ）

→ Kotlin 側で `Dispatchers.IO` のコルーチンとして実行し、`AsyncFunction` で公開する。

**制約2: 初期化完了前に広告をロードしてはいけない**（特にメディエーションのアダプタ初期化待ちが必要）

→ **初期化未完了時の `createBannerAd()` は例外にせず、ロードをキューして初期化完了時に自動で流す。**

制約2 への対応が本ライブラリで唯一の非自明なロジックである。「プリロードのために早期に広告を
作る」という本ライブラリの使い方と、「初期化を待て」という SDK の制約が正面衝突するため、
ここはライブラリが面倒を見るべき箇所と判断した。

ただし `initialize()` が**そもそも呼ばれていない**場合、広告は永久に `'loading'` のまま
静かに止まってしまう。これを防ぐため、`initialize()` が未呼び出しの状態で `createBannerAd()` が
呼ばれたら `__DEV__` で即座に警告を出す（タイマーは使わない）。

## 8. メディエーション

アダプタは各ネットワークのネイティブ依存である。

**ライブラリ側でアダプタのバージョンを固定した「キュレート済みリスト」は持たない。**
アダプタのバージョンは頻繁に動くため、リストは陳腐化して保守負債になる
（`react-native-google-mobile-ads` が抱えている問題そのものである）。

代わりに素の指定口を config plugin に用意する。

```json
["expo-google-mobile-ads", {
  "androidDependencies": ["com.google.ads.mediation:applovin:13.5.0.0"],
  "androidMavenRepositories": ["https://artifact.bytedance.com/repository/pangle/"],
  "iosPods": { "GoogleMobileAdsMediationAppLovin": "13.5.0.0" }
}]
```

ネットワーク固有の追加設定（Pangle の Maven リポジトリなど）もこの口で表現できる。

利用者向けには、主要ネットワークの設定例をドキュメントに載せる（コードではなくドキュメントとして
持つことで、バージョン追従の責任をライブラリから切り離す）。

## 9. エラー処理

**ロード失敗は例外にしない。** 在庫なし（`NO_FILL`）は日常的に発生する正常系であり、
状態とイベントで表現する。例外は設定ミス（App ID 未設定など）にのみ使う。

```typescript
type AdError = {
  code: number;
  message: string;
  domain: string;
  responseInfo?: ResponseInfo;
};

type ResponseInfo = {
  responseId?: string;
  mediationAdapterClassName?: string;
  adSourceName?: string;
  adapterResponses: AdapterResponse[];   // ウォーターフォール全段の結果
};

type AdapterResponse = {
  adapterClassName: string;
  latencyMillis: number;
  adError?: { code: number; message: string; domain: string };
};
```

`AdapterResponse` に `description` は**含めない**。実装時に確認したところ、iOS の
`GADAdNetworkResponseInfo` に公開された `description` プロパティが存在せず、`NSObject` の既定実装に
落ちて無意味な文字列を返すためである。なお `InitializationStatus.adapterStatuses[].description` は
別のフィールドで、こちらは両 OS の SDK が実際に提供するため保持している。

`latencyMillis` の単位はミリ秒で両 OS 統一する（iOS の SDK は秒を返すためライブラリ側で換算する）。

`responseInfo` はメディエーション運用で「どのネットワークが埋めたか / どこで落ちたか」を追う
唯一の手段のため、**成功時（`ad.responseInfo`）と失敗時（`error.responseInfo`）の両方で公開する**。

## 10. テスト戦略

JS 層は TDD（t_wada 流）で先にテストを書く。

| 層 | 方法 | 対象 |
|---|---|---|
| JS ロジック | Jest（ネイティブモジュールをモック） | 初期化前ロードのキュー処理、状態遷移、イベント→state 反映 |
| hooks | `@testing-library/react-native` | `useBannerAd` の購読・解放、アンマウント時の挙動、オーバーロード両形 |
| ネイティブ | example アプリ + Google のテスト広告ユニット ID | 実ロード、View 再利用、回転、メディエーション疎通 |

キュー処理と状態遷移がこのライブラリで唯一の非自明なロジックのため、テストはそこに集中させる。

ネイティブ層は example アプリを手動 QA チェックリスト付きで整備する。

## 11. ディレクトリ構成

```
expo-google-mobile-ads/
├── src/
│   ├── ExpoGoogleMobileAdsModule.ts    # NativeModule バインディング
│   ├── BannerAd.ts                     # createBannerAd / BannerAd 型
│   ├── BannerAdView.tsx
│   ├── BannerAdSize.ts
│   ├── initialization.ts               # initialize / キュー処理
│   ├── types.ts                        # AdError / ResponseInfo など
│   ├── hooks/
│   │   ├── useBannerAd.ts
│   │   └── useBannerAdSize.ts
│   └── index.ts
├── android/                            # Kotlin, GMA Next-Gen SDK
├── ios/                                # Swift, GMA iOS SDK v13
├── plugin/                             # config plugin
└── example/                            # 動作確認 + 手動QA用アプリ
```

## 12. 今後のフェーズ

| フェーズ | 内容 |
|---|---|
| 1（本設計） | バナー広告 |
| 2 | UMP（同意管理） |
| 3 | インタースティシャル / リワード / アプリ起動時 / ネイティブ広告 |

フェーズ3は本設計の「命令型コア（SharedObject）+ hooks」パターンをそのまま横展開する。

## 13. 参考資料

- [Set up GMA Next-Gen SDK | Android](https://developers.google.com/admob/android/next-gen/quick-start)
- [Initialize GMA Next-Gen SDK | Android](https://developers.google.com/admob/android/next-gen/migration)
- [AdSize | Android Next-Gen SDK](https://developers.google.com/admob/android/next-gen/reference/com/google/android/libraries/ads/mobile/sdk/banner/AdSize)
- [Choose networks | Android Next-Gen SDK](https://developers.google.com/admob/android/next-gen/mediation/choose-networks)
- [Migrate SDK versions | iOS](https://developers.google.com/admob/ios/migration)
- [Shared objects | Expo Modules API](https://docs.expo.dev/modules/shared-objects/)
- [expo-video: a simple, powerful way to play videos in apps](https://expo.dev/blog/expo-video-a-simple-powerful-way-to-play-videos-in-apps)
