---
title: "同意管理 (UMP)"
description: "広告をリクエストする前に UMP の同意を取得し、canRequestAds で判定する。"
---

Google User Messaging Platform (UMP) SDK は、アプリがそもそも広告をリクエストしてよいかどうかを決める同意(EEA 圏の GDPR や、他地域の同等の規制)を収集する。`initialize()` より前に実行すること — `canRequestAds` が分かるまでは、広告ロードに関わる他のことは何も安全に行えない。

```typescript
import { gatherConsent, initialize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();
```

**判定には `status` ではなく `canRequestAds` を使う。** `canRequestAds` は、そもそも同意が不要なユーザー(EEA 圏外など)や、広告配信に最低限必要な範囲だけ同意したユーザーに対してもすでに `true` になっている — `status` だけではこのどちらも判別できない。

## 関数

6つすべてが `ConsentInfo` のスナップショットで resolve し、`ConsentError`(`code: ConsentErrorCode`、詳細は後述)で reject する。

```typescript
function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function showConsentFormIfRequired(): Promise<ConsentInfo>;
function showPrivacyOptionsForm(): Promise<ConsentInfo>;
function getConsentInfo(): Promise<ConsentInfo>;
function resetConsent(): Promise<ConsentInfo>;
```

- `gatherConsent(options?)` — 最新の同意情報を取得し、必要であれば同時にフォームを表示する。ネイティブ側の1回の呼び出しにまとめられている。上のフローがまさにこれである
- `requestConsentInfoUpdate(options?)` — 最新の同意情報を取得するが、フォームは表示しない。更新とは別のタイミングでフォームを表示したい場合にのみ使う。それ以外は `gatherConsent()` が両方をまとめて行う
- `showConsentFormIfRequired()` — `status` が `'required'` のときだけフォームを表示し、それ以外は何も表示せずに resolve する。事前に `requestConsentInfoUpdate()` が成功している必要がある
- `showPrivacyOptionsForm()` — ユーザーがすでに行った選択を変更できるよう、プライバシーオプションフォームを表示する。`privacyOptionsRequirement` が `'required'` のときのみ提供すること
- `getConsentInfo()` — ネットワークに接続せず、現在の同意情報を読み取る
- `resetConsent()` — 保存済みの同意情報を消去し、フォームを再び表示できるようにする。**開発ビルド限定** — `__DEV__` が false のときは no-op になる

## `useConsentInfo()`

```tsx
import { useConsentInfo, showPrivacyOptionsForm } from '@kazutoyo/expo-google-mobile-ads';

function PrivacySettingsRow() {
  const { privacyOptionsRequirement } = useConsentInfo();
  if (privacyOptionsRequirement !== 'required') return null;
  return <Button title="Privacy options" onPress={() => showPrivacyOptionsForm()} />;
}
```

`useConsentInfo()` は読み取り専用である — それ自体が SDK を呼び出すことはなく、アプリ内で行われた直近の同意呼び出しの結果を購読するだけである。

**マウント時に SDK が保持する永続化済みの同意情報を取り込むことはしない。** アプリを再起動すると、ネイティブ SDK 側は `'obtained'` を保持したままであっても、`useConsentInfo()` は何らかの同意関数が呼ばれるまで `status: 'unknown'` / `canRequestAds: false` を報告し続ける。これは意図的な設計である — この hook が自発的に SDK を呼び出すことは決してなく、上記の起動時フローはこの挙動の影響を受けない(`gatherConsent()` はどのみち起動時に実行されるため)。しかし、**`useConsentInfo()` だけを見て「プライバシーオプション」ボタンの表示を決める設定画面は、その起動中にアプリがすでに `gatherConsent()`(または `getConsentInfo()`)を呼んでいない限り、再起動後は何も表示しなくなる**。

もう一点: `ConsentInfo` の4つのフィールドはいずれも、ユーザーが選んだプライバシー上の**どの選択肢**だったかによっては変化しない — これらは同意が必要かどうか、広告をリクエストできるかどうかを表すものであり、何を選んだかを表すものではない。`useConsentInfo()` がパーソナライズのトグルを反映すると期待しないこと。

## 型

`ConsentInfo` — すべての同意関数が resolve する値:

| フィールド | 型 | 意味 |
|---|---|---|
| `status` | `'unknown' \| 'required' \| 'notRequired' \| 'obtained'` | UMP 自身の同意ステータス。`'unknown'` は同意呼び出しが一度も成功していない状態を意味する |
| `canRequestAds` | `boolean` | 今すぐ広告をリクエストしてよいか — 判定には `status` ではなくこちらを使う |
| `isConsentFormAvailable` | `boolean` | 現時点でフォームを表示できるか |
| `privacyOptionsRequirement` | `'unknown' \| 'required' \| 'notRequired'` | 自前のプライバシーオプション導線は、これが `'required'` のときだけ表示する |

`ConsentRequestOptions` — `gatherConsent()` / `requestConsentInfoUpdate()` に渡すオプション:

| フィールド | 型 | 意味 |
|---|---|---|
| `tagForUnderAgeOfConsent?` | `boolean` | UMP 独自のフラグ — `RequestConfiguration.tagForUnderAgeOfConsent` とは別物。両方に該当する場合は両方に設定すること |
| `debugSettings?.testDeviceIds?` | `string[]` | `debugSettings.geography` を適用する対象デバイス。詳細は下記「テスト方法」を参照 |
| `debugSettings?.geography?` | `'disabled' \| 'eea' \| 'regulatedUsState' \| 'other'` | 疑似的に設定する地域 — `testDeviceIds` に含まれないデバイスでは無視される |

`ConsentErrorCode` — `ConsentError.code`:

| コード | 意味 |
|---|---|
| `network` | 同意サーバーとの通信エラー |
| `timeout` | リクエストがタイムアウトした |
| `invalidOperation` | 呼び出し順序の誤り(例: 更新前にフォームを表示しようとした) |
| `misconfiguration` | **iOS 限定** — App ID または AdMob コンソール側の UMP 設定が誤っている |
| `formUnavailable` | **iOS 限定** — このユーザー向けの同意フォームを読み込めなかった |
| `internal` | SDK 内部エラー。Android では、アプリの React context が破棄された場合もこれに含まれる |
| `noActivity` | **Android 限定** — フォアグラウンドに Activity がない状態で呼び出しが到達した |
| `unknown` | ネイティブ側から認識可能なコードが送られてこなかった場合 |

## テスト方法

`debugSettings.geography` で地域を疑似的に指定すると、実際には EEA 圏外のデバイスでも EEA のフローを再現できる — `testDeviceIds` に列挙したデバイスにのみ適用される:

```typescript
await gatherConsent({
  debugSettings: { geography: 'eea', testDeviceIds: ['<your test device id>'] },
});
```

両 SDK とも、最初に同意関数を呼び出した時点で、そのデバイスに必要な ID をコンソール(iOS)/ logcat(Android)に出力する — まず `testDeviceIds` なしで一度実行し、ログに出た ID をコピーして追加する。

`resetConsent()` は**開発限定**であり、デバイスを再テスト可能にする唯一の手段である。SDK は同意情報を永続化するため、これを呼ばない限りデバイスは一度しかフローを通過できず、以降はアプリの再インストールなしには二度とフォームが表示されない。

## プラットフォーム差

- `isConsentFormAvailable` は、iOS の3値を取る `UMPFormStatus`(`unknown` / `available` / `unavailable`)を、Android が返す boolean に丸めたものである — iOS の `unknown` は `false` として報告される
- `misconfiguration` と `formUnavailable` は iOS でのみ発生する
- `noActivity` は Android でのみ発生する
- すべての同意関数は両プラットフォームで `async` である — iOS の `UMPConsentInformation` はプロパティの getter に至るまでメインスレッド専用のため
