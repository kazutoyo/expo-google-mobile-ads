# expo-google-mobile-ads: 全画面広告（インタースティシャル / リワード）API 設計

作成日: 2026-08-28
ステータス: 設計中
前提: フェーズ1（バナー）完了。PR #1

## 1. 目的

インタースティシャル広告とリワード広告を追加する。フェーズ1で確立した
「SharedObject の命令型コア + 薄い hooks」をそのまま横展開する。

ネイティブ広告は本フェーズに含めない（素材から利用者が自前 UI を組む形式で構造が根本的に違い、
着手時に別途の設計判断が要る）。UMP も含めない。アプリ起動時広告も依頼に無いので作らない。

## 2. バナーと変わる点

| | バナー | 全画面広告 |
|---|---|---|
| 表示 | `<BannerAdView>` にアタッチ | View を持たない。`show()` で提示 |
| 再利用 | 画面遷移をまたいで再利用する | **使い切り**。表示したら作り直す |
| 操作 | 無い（置くだけ） | 始まりと終わりがある離散的な操作 |

この「離散的な操作である」という違いが、後述の Promise 設計の根拠になる。

## 3. 実 SDK の調査結果

**ドキュメントではなく、インストール済みの SDK バイナリから抽出した**
（iOS: pod 13.7.0 のヘッダ / Android: next-gen 1.4.0 を javap）。
詳細は `.superpowers/sdd/phase2-api-recon.md`。

フェーズ1では、ドキュメントから書いたネイティブコードが実 SDK と
プラットフォームあたり9箇所食い違い、すべて修正ラウンドを消費した。同じ轍を踏まないため
本設計は最初からバイナリ由来の事実に基づく。

### ロードと表示

| | iOS | Android |
|---|---|---|
| インタースティシャル load | `load(with:request:completionHandler:)` | `static load(AdRequest, AdLoadCallback<InterstitialAd>)` |
| インタースティシャル show | `present(from:)` → void | `show(Activity)` → void |
| リワード show | `present(from:userDidEarnRewardHandler:)` → void | `show(Activity, OnUserEarnedRewardListener)` |

**Android には `InterstitialAdRequest` / `RewardedAdRequest` が存在しない。**
バナーの `BannerAdRequest.Builder` と違い、共通の `AdRequest.Builder(adUnitId)` を使う。

### ドキュメントと食い違う点（バイナリで確認）

1. **iOS のリワードハンドラは引数を取らない。**
   `GADUserDidEarnRewardHandler` は `void(^)(void)`。報酬は `adReward` プロパティから読むが、
   これは **表示前から埋まっている** ため、それ自体は「獲得した」ことを意味しない。
   iOS では「ハンドラが発火したか」をラッチして初めて獲得を判定できる。
   Google のドキュメントはハンドラが報酬を受け取るかのように読める。
2. **`adDidPresentFullScreenContent:` は 13.7.0 で `NS_UNAVAILABLE`。**
   Google のサンプルには繰り返し登場するが、使うとコンパイルが通らない。
3. **Android に準備完了チェックが存在しない。**
   `isReady` / `canShow` / `isLoaded` のいずれも無い（3領域を走査して0件）。
   iOS には `canPresent(from:)` がある。
4. **どちらの `show` も同期的に失敗を返さない。** 失敗は必ず非同期のコールバック経由。

### 使い切りの裏付け

両 SDK のエラーコードで確認できる。iOS は `AdAlreadyUsed = 18` と `AdNotReady = 15`、
Android は `FullScreenContentError.ErrorCode.AD_REUSED`。

## 4. JS API

```typescript
function createInterstitialAd(options: FullScreenAdOptions): InterstitialAd;
function createRewardedAd(options: FullScreenAdOptions): RewardedAd;

type FullScreenAdOptions = {
  adUnitId: string;
  requestOptions?: RequestOptions;   // フェーズ1と共通
};

class InterstitialAd extends SharedObject {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  load(): void;
  show(): Promise<void>;
}

class RewardedAd extends SharedObject {
  readonly status: FullScreenAdStatus;
  readonly error?: AdError;
  readonly responseInfo?: ResponseInfo;
  /** 表示前から読める。獲得を意味しない（iOS の adReward と同じ性質） */
  readonly reward?: AdReward;
  load(): void;
  show(): Promise<AdReward | null>;
}

type FullScreenAdStatus = 'loading' | 'loaded' | 'shown' | 'error';

type AdReward = { type: string; amount: number };
```

### 状態遷移

```
loading ──成功──> loaded ──show()──> shown
   │                 │
   └──失敗──> error   └──表示失敗──> error（再表示不可、作り直す）
```

`shown` は終端。`load()` での再利用はしない（SDK 自体が一度きりのオブジェクト）。

### hooks

```typescript
function useInterstitialAd(options: FullScreenAdOptions): FullScreenAdState & { ad: InterstitialAd };
function useInterstitialAdState(ad: InterstitialAd): FullScreenAdState;
function useRewardedAd(options: FullScreenAdOptions): FullScreenAdState & { ad: RewardedAd };
function useRewardedAdState(ad: RewardedAd): FullScreenAdState;

type FullScreenAdState = {
  isLoaded: boolean;   // status === 'loaded'
  error?: AdError;
};
```

フェーズ1と同じ命名規則。生成する側が主名称、購読のみが `...State`。
フェーズ1で確立したとおり、オーバーロードで1つの名前に統一すると
フックの条件付き呼び出しになるため分ける。

## 5. `show()` の設計

### Promise を返す

バナーはイベントのみで Promise を持たないが、全画面広告は**始まりと終わりがある離散的な操作**
なので事情が違う。閉じた後に処理を続けたいのが通常の使い方であり、リワードでは
獲得結果そのものが欲しい。

```typescript
await interstitial.show();                    // 閉じられたら解決
const reward = await rewarded.show();         // 獲得報酬、未獲得なら null
```

### Promise の3つの出口

**表示に失敗した場合、広告は開かないので dismiss イベントも来ない。**
したがって解決経路を dismiss だけにすると Promise が永久に解決しない。

| 出口 | 契機 |
|---|---|
| resolve | 広告が閉じられた（`didDismissFullScreenContent` / `onAdDismissedFullScreenContent`） |
| reject | 表示に失敗した（`didFailToPresentFullScreenContent` / `onAdFailedToShowFullScreenContent`） |
| reject | 事前チェックで弾いた（下記） |

### 未ロード時は待たずに reject する

```typescript
try {
  await ad.show();
} catch (e) {
  // e.code: 'notLoaded' | 'alreadyShown' | 'failedToShow'
}
```

`notLoaded` と `alreadyShown` は**ライブラリが自分の `status` を見て判定する**。
Android に準備完了チェックが存在しないため、SDK に問い合わせる方法は元々無い。
結果として両プラットフォームで判定根拠が同一になり、挙動も揃う。

待つ設計にしない理由は UX である。「ロードが終わったら表示」にすると、広告は利用者が
とっくに次の操作に移った後で唐突に割り込む。全画面広告が予期しないタイミングで出るのは
Google 自身がポリシーで戒めている挙動であり、ライブラリが親切のつもりで待つと
利用者を悪い実装へ誘導する。

正しい書き方は「`isLoaded` を見て、false なら広告を出さずに先へ進む」である。
これはフェーズ1で決めた「例外は呼び出し側の誤りにのみ使う」区分と一致する
（在庫なしは日常的な正常系なので `status` で表す）。

## 6. イベント

| イベント名 | ペイロード | iOS | Android |
|---|---|---|---|
| `statusChange` | `{ status, error? }` | — | — |
| `showed` | なし | `adWillPresentFullScreenContent` | `onAdShowedFullScreenContent` |
| `dismissed` | なし | `adDidDismissFullScreenContent` | `onAdDismissedFullScreenContent` |
| `impression` | なし | `adDidRecordImpression` | `onAdImpression` |
| `clicked` | なし | `adDidRecordClick` | `onAdClicked` |
| `paid` | `PaidEventValue` | `paidEventHandler`（クロージャ） | `onAdPaid(AdValue)` |
| `earnedReward` | `AdReward` | ハンドラ発火をラッチ | `onUserEarnedReward(RewardItem)` |

`showed` の対応付けには**意図的な差異**がある。iOS の `adDidPresentFullScreenContent:` は
`NS_UNAVAILABLE` なので `adWillPresentFullScreenContent` を使う。厳密には iOS が
「表示直前」、Android が「表示後」だが、どちらも「広告が画面に出る」を意味するため
同一イベントに束ねる。ドキュメントに明記する。

iOS の `adWillDismissFullScreenContent` は**使わない**。Android に対応物が無く、
使えば `dismissed` が両プラットフォームで別の意味になる。

## 7. 報酬の扱い

`RewardedAd.reward` は**表示前から読める**（iOS の `adReward` の性質をそのまま反映）。
これは「この広告を見たら何がもらえるか」を表示前に UI に出すための情報であり、
**獲得したことを意味しない**。ドキュメントで強調する。

獲得したかどうかは `show()` の解決値でのみ判定する。

- **Android**: `onUserEarnedReward(RewardItem)` が `getType(): String` と `getAmount(): Int` を渡す
- **iOS**: ハンドラは引数を取らないので、発火したことをラッチし、`adReward` から値を読む

つまり iOS では「ハンドラが発火しなければ `null`」という組み立てが必須である。
`adReward` が非 nil だからといって獲得したと判定してはならない。

## 8. 本フェーズに含めないもの

| 項目 | 理由 |
|---|---|
| サーバーサイド検証（SSV） | 依頼に無い。両プラットフォームでフィールド名が違う（`userId`/`customData` vs `userIdentifier`/`customRewardText`）ため、追加時に別途の設計判断が要る |
| Android の `setImmersiveMode` | Android 専用。対応物が無い API を片側だけ生やさない |
| アプリ起動時広告 | 依頼に無い |
| ネイティブ広告 / UMP | 別フェーズ |

## 9. フェーズ1から持ち込む制約

実装タスクには以下を必ず申し送る。すべてフェーズ1で実機か SDK ソースでしか
見つからなかったもので、同じ構造を使う以上、同じ罠が同じ場所にある。

- Expo の同期 `Function` / `Constructor` は **JS スレッド**で動く。UIKit / GMA の呼び出しは
  main へ回す。Android の `MobileAds.initialize()` は逆にバックグラウンド必須
- SharedObject の解放フックは**レジストリのロック保持下で呼ばれる**。そこで main を
  同期待ちするとデッドロックする。非同期で投げること
- **表示時に Activity / rootViewController が無い可能性**がある。生成時にキャッシュせず
  `show()` 時に解決し、取れなければ無言で失敗させずエラーとして surface する。
  Android の `currentActivity` は nullable で、iOS の VC は nullable 引数なので
  **Android 側だけの失敗経路**になりうる
- ネイティブ View に SharedObject をそのまま prop で渡すと `__DEV__` の RN が deep-freeze して
  以降の `release()` が必ず例外になる（全画面広告は View を持たないので該当しないが、
  SharedObject を JS 境界で扱う際の一般則として留意）
- `useEvent` の `initialValue` は `useState` の初期値にしかならない。購読先が変わっても
  状態がリセットされないため、ad の同一性でキーを切る
- 解放時は Android の `destroy()` を呼び、両プラットフォームでコールバックを全てクリアする

## 10. テスト方針

フェーズ1と同じ。JS 層は TDD で先にテストを書き、ネイティブ層は example アプリと
手動 QA チェックリストで担保する。

全画面広告特有の確認項目:

- 未ロード時の `show()` が待たずに reject し、`e.code` が `notLoaded` であること
- 表示済みの広告への再 `show()` が `alreadyShown` で reject すること
- 表示に失敗したとき Promise が**解決も拒否もされないまま残らない**こと
- リワードで報酬を受け取らずに閉じた場合に `null` が返ること（iOS のラッチが効いているか）
- 表示中にアプリをバックグラウンドへ送って戻した場合の挙動
- 初期化前に `createInterstitialAd()` してもキューが効くこと（フェーズ1のキュー機構）
