---
title: "同意管理 (UMP)"
description: "広告をリクエストする前に UMP の同意を取得し、canRequestAds で判定します。"
---

Google User Messaging Platform (UMP) SDK は、広告をリクエストしてよいかどうかの同意を取得します。対象は EEA の GDPR と、他地域の同等の規制です。

同意の取得は `initialize()` より前に実行してください。`canRequestAds` が確定するまで、広告のロードは始められません。

```typescript
import { gatherConsent, initialize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();
```

**判定には `status` ではなく `canRequestAds` を使ってください。** 同意が不要なユーザー（EEA 圏外など）も、配信に最低限必要な範囲だけ同意したユーザーも、`canRequestAds` は `true` になります。`status` を見ただけでは、このどちらも判別できません。

## 関数

6つの関数はすべて、`ConsentInfo` のスナップショットで resolve します。失敗したときは `ConsentError`（`code` は後述の `ConsentErrorCode`）で reject します。

```typescript
function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function showConsentFormIfRequired(): Promise<ConsentInfo>;
function showPrivacyOptionsForm(): Promise<ConsentInfo>;
function getConsentInfo(): Promise<ConsentInfo>;
function resetConsent(): Promise<ConsentInfo>;
```

- `gatherConsent(options?)` — 最新の同意情報を取得し、必要ならフォームも表示します。ネイティブ側では1回の呼び出しにまとまっています。上の例で使っているのがこれです
- `requestConsentInfoUpdate(options?)` — 同意情報の更新だけを行い、フォームは表示しません。更新とフォーム表示のタイミングを分けたいときに使います。分ける必要がなければ `gatherConsent()` で足ります
- `showConsentFormIfRequired()` — `status` が `'required'` のときだけフォームを表示します。それ以外は何も表示せずに resolve します。事前に `requestConsentInfoUpdate()` が成功している必要があります
- `showPrivacyOptionsForm()` — 一度行った選択を変更するためのフォームを表示します。この導線は `privacyOptionsRequirement` が `'required'` のときだけ置いてください
- `getConsentInfo()` — 通信せずに、現在の同意情報を読み取ります
- `resetConsent()` — 保存済みの同意を削除し、フォームを再表示できる状態に戻します。**開発ビルド限定**で、`__DEV__` が false のときは何もしません

## `useConsentInfo()`

```tsx
import { useConsentInfo, showPrivacyOptionsForm } from '@kazutoyo/expo-google-mobile-ads';

function PrivacySettingsRow() {
  const { privacyOptionsRequirement } = useConsentInfo();
  if (privacyOptionsRequirement !== 'required') return null;
  return <Button title="Privacy options" onPress={() => showPrivacyOptionsForm()} />;
}
```

`useConsentInfo()` は読み取り専用です。自分から SDK を呼ぶことはなく、アプリ内で最後に実行された同意関数の結果を購読します。

**マウント時に、SDK が永続化している同意情報を読み込むことはしません。** アプリを再起動すると、ネイティブ SDK が `'obtained'` を保持していても、同意関数が呼ばれるまでは `status: 'unknown'` / `canRequestAds: false` を返します。

これは意図的な挙動です。起動時に `gatherConsent()` を通るフローであれば、影響はありません。

注意が必要なのは設定画面です。**`useConsentInfo()` の値だけで「プライバシーオプション」ボタンの表示を決めていると、その起動中に `gatherConsent()` か `getConsentInfo()` を一度も呼んでいない場合、再起動後はボタンが表示されません。**

また、`ConsentInfo` の4つのフィールドは、ユーザーが**どの選択肢**を選んだかでは変化しません。同意が必要か、広告をリクエストできるかを表すだけで、選択の内容は持っていないためです。パーソナライズのトグルの状態は取得できません。

## 型

`ConsentInfo` — すべての同意関数が resolve する値:

| フィールド | 型 | 意味 |
|---|---|---|
| `status` | `'unknown' \| 'required' \| 'notRequired' \| 'obtained'` | UMP 自身の同意ステータス。`'unknown'` は同意呼び出しが一度も成功していない状態 |
| `canRequestAds` | `boolean` | 今すぐ広告をリクエストしてよいか。判定には `status` ではなくこちらを使う |
| `isConsentFormAvailable` | `boolean` | 現時点でフォームを表示できるか |
| `privacyOptionsRequirement` | `'unknown' \| 'required' \| 'notRequired'` | 自前のプライバシーオプション導線は、これが `'required'` のときだけ表示する |

`ConsentRequestOptions` — `gatherConsent()` / `requestConsentInfoUpdate()` に渡すオプション:

| フィールド | 型 | 意味 |
|---|---|---|
| `tagForUnderAgeOfConsent?` | `boolean` | UMP 独自のフラグ。`RequestConfiguration.tagForUnderAgeOfConsent` とは別物で、両方に該当する場合は両方に設定する |
| `debugSettings?.testDeviceIds?` | `string[]` | `debugSettings.geography` を適用する対象デバイス。詳細は後述の「テスト方法」を参照 |
| `debugSettings?.geography?` | `'disabled' \| 'eea' \| 'regulatedUsState' \| 'other'` | 疑似的に設定する地域。`testDeviceIds` に含まれないデバイスでは無視される |

`ConsentErrorCode` — `ConsentError.code`:

| コード | 意味 |
|---|---|
| `network` | 同意サーバーとの通信エラー |
| `timeout` | リクエストがタイムアウトした |
| `invalidOperation` | 呼び出し順序の誤り（例: 更新前にフォームを表示しようとした） |
| `misconfiguration` | **iOS 限定。** App ID または AdMob コンソール側の UMP 設定が誤っている |
| `formUnavailable` | **iOS 限定。** このユーザー向けの同意フォームを読み込めなかった |
| `internal` | SDK 内部エラー。Android では、アプリの React context が破棄された場合もこれに含まれる |
| `noActivity` | **Android 限定。** フォアグラウンドに Activity がない状態で呼び出しが到達した |
| `unknown` | ネイティブ側から認識可能なコードが送られてこなかった |

## テスト方法

`debugSettings.geography` で地域を指定すると、EEA 圏外のデバイスでも EEA のフローを再現できます。適用されるのは `testDeviceIds` に挙げたデバイスだけです。

```typescript
await gatherConsent({
  debugSettings: { geography: 'eea', testDeviceIds: ['<your test device id>'] },
});
```

両 SDK とも、最初に同意関数を呼んだ時点で、そのデバイスの ID をコンソール（iOS）や logcat（Android）に出力します。まず `testDeviceIds` なしで一度実行し、出力された ID をコピーして追加してください。

`resetConsent()` は**開発ビルド限定**ですが、同じデバイスで再テストする唯一の手段でもあります。SDK は同意を永続化するため、これを呼ばないと同意フローを通れるのは一度だけです。以降はアプリを入れ直すまでフォームが表示されません。

## プラットフォーム差

- `isConsentFormAvailable` は、iOS の3値 `UMPFormStatus`（`unknown` / `available` / `unavailable`）を Android の boolean に合わせたものです。iOS の `unknown` は `false` になります
- `misconfiguration` と `formUnavailable` は iOS でのみ発生します
- `noActivity` は Android でのみ発生します
- 同意関数は両プラットフォームともすべて `async` です。iOS の `UMPConsentInformation` が、プロパティの getter までメインスレッド専用であるためです
