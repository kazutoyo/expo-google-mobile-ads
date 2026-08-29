---
title: "同意管理 (UMP)"
description: "広告をリクエストする前に UMP の同意を取得し、canRequestAds で判定する。"
---

Google User Messaging Platform (UMP) SDK は、そもそも広告をリクエストしてよいかを決める同意（EEA の GDPR と、他地域の同等の規制）を集める。`initialize()` より前に実行する。`canRequestAds` が分かるまで、広告ロードに関わることは何も始められない。

```typescript
import { gatherConsent, initialize } from '@kazutoyo/expo-google-mobile-ads';

const { canRequestAds } = await gatherConsent();
if (canRequestAds) await initialize();
```

**判定は `status` ではなく `canRequestAds` で行う。** 同意が不要なユーザー（EEA 圏外など）も、配信に最低限必要な範囲だけ同意したユーザーも、`canRequestAds` は `true` になる。`status` だけではこのどちらも判別できない。

## 関数

6つとも `ConsentInfo` のスナップショットで resolve し、`ConsentError`（`code: ConsentErrorCode`、後述）で reject する。

```typescript
function gatherConsent(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function requestConsentInfoUpdate(options?: ConsentRequestOptions): Promise<ConsentInfo>;
function showConsentFormIfRequired(): Promise<ConsentInfo>;
function showPrivacyOptionsForm(): Promise<ConsentInfo>;
function getConsentInfo(): Promise<ConsentInfo>;
function resetConsent(): Promise<ConsentInfo>;
```

- `gatherConsent(options?)` — 最新の同意情報を取得し、必要ならフォームも出す。ネイティブ側の1回の呼び出しにまとまっている。上のフローがこれ
- `requestConsentInfoUpdate(options?)` — 同意情報の更新だけ行い、フォームは出さない。更新とフォーム表示のタイミングを分けたいときに使う。分ける必要がなければ `gatherConsent()` で足りる
- `showConsentFormIfRequired()` — `status` が `'required'` のときだけフォームを出す。そうでなければ何も出さずに resolve する。先に `requestConsentInfoUpdate()` が成功している必要がある
- `showPrivacyOptionsForm()` — 一度した選択を変えるためのフォームを出す。導線を置くのは `privacyOptionsRequirement` が `'required'` のときだけにする
- `getConsentInfo()` — 通信せずに現在の同意情報を読む
- `resetConsent()` — 保存済みの同意を消して、フォームを再表示できる状態に戻す。**開発ビルド限定**で、`__DEV__` が false なら no-op

## `useConsentInfo()`

```tsx
import { useConsentInfo, showPrivacyOptionsForm } from '@kazutoyo/expo-google-mobile-ads';

function PrivacySettingsRow() {
  const { privacyOptionsRequirement } = useConsentInfo();
  if (privacyOptionsRequirement !== 'required') return null;
  return <Button title="Privacy options" onPress={() => showPrivacyOptionsForm()} />;
}
```

`useConsentInfo()` は読み取り専用。自分から SDK を呼ぶことはなく、アプリ内で最後に走った同意呼び出しの結果を購読するだけだ。

**マウント時に SDK の永続化済み同意情報を取り込むことはしない。** アプリを再起動すると、ネイティブ SDK が `'obtained'` を保持していても、同意関数が呼ばれるまで `status: 'unknown'` / `canRequestAds: false` を返し続ける。

これは意図的だ。この hook が自分から SDK を呼ぶことは絶対にない。起動時フローは `gatherConsent()` をどのみち通るので影響を受けない。ただし、**`useConsentInfo()` だけを見て「プライバシーオプション」ボタンの表示を決める設定画面は、その起動中に `gatherConsent()`（か `getConsentInfo()`）を通っていない限り、再起動後は何も出さなくなる**。

もう一点。`ConsentInfo` の4つのフィールドは、ユーザーが**どの選択肢**を選んだかでは変化しない。同意が要るか、広告をリクエストできるかを表すだけで、何を選んだかは持っていない。パーソナライズのトグルが反映されると期待しないこと。

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

`debugSettings.geography` で地域を指定すると、EEA 圏外のデバイスでも EEA のフローを再現できる。効くのは `testDeviceIds` に挙げたデバイスだけ:

```typescript
await gatherConsent({
  debugSettings: { geography: 'eea', testDeviceIds: ['<your test device id>'] },
});
```

両 SDK とも、最初に同意関数を呼んだ時点で、そのデバイスの ID をコンソール（iOS）や logcat（Android）に出す。まず `testDeviceIds` なしで一度実行し、出た ID をコピーして追加する。

`resetConsent()` は**開発限定**だが、デバイスを再テスト可能にする唯一の手段でもある。SDK は同意を永続化するので、これを呼ばなければフローを通れるのは一度きり。以降はアプリを入れ直すまでフォームが出ない。

## プラットフォーム差

- `isConsentFormAvailable` は、iOS の3値 `UMPFormStatus`（`unknown` / `available` / `unavailable`）を Android の boolean に丸めたもの。iOS の `unknown` は `false` になる
- `misconfiguration` と `formUnavailable` は iOS でのみ発生する
- `noActivity` は Android でのみ発生する
- 同意関数はすべて両プラットフォームで `async`。iOS の `UMPConsentInformation` がプロパティの getter までメインスレッド専用のため
