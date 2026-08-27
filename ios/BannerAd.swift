import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// メインスレッド上ならそのまま実行し、そうでなければ `DispatchQueue.main.sync` で
/// メインスレッドへ同期的にホップしてから実行する。
///
/// UIKit と GoogleMobileAds のほとんどの API はメインスレッド専用（`GADAdSize.h` の
/// アダプティブサイズ関数群には "This function must be called on the main queue." と明記
/// されている）。一方、Expo Modules の `Constructor` / `Function` / `Property` はどのスレッドで
/// 呼ばれるか保証されない（`AsyncFunction` の既定キューもメインではない）ため、UIKit/GMA に
/// 触れる箇所はこの関数でメインスレッドへ同期させる。
///
/// **残っているリスク（正直に書く）**: React Native の New Architecture には、メインスレッドが
/// JS ランタイムに対して同期的に割り込む経路が実在する
/// （`AppleEventBeat::activityDidChange` → `EventBeat::induce()` →
/// `RuntimeScheduler::executeNowOnTheSameThread`、`EventBeat.cpp` 自身が
/// "Both JS and UI thread are blocked" とコメントしている。`experimental_flushSync` や
/// サードパーティ製ライブラリ経由で到達しうる）。同期の `Function`/`Property` の本体は
/// **JS ランタイムを保持したまま** JS スレッド上で実行されるため、そこで `main.sync` を呼んで
/// いる最中に main がまさにこの経路で同じ JS ランタイムへ同期的に割り込もうとすれば、
/// 双方が相手を待つ形になり得る。つまり「main.sync を使っている箇所はロックを持たれていない
/// から安全」と言い切ることはできない —— これは同期的な main ホップを提供する API 全般に
/// 付随する原理的なリスクであり、`runOnMain` 固有の欠陥ではない。
///
/// そのためこの `runOnMain`（＝ブロッキングな `main.sync`）を使う箇所は最小限に絞ってある。
/// `ios/` 全体を grep した時点で、`runOnMain` の呼び出し元は次の 5 箇所（この関数の定義を
/// 除く）だけである。それぞれ「なぜ非同期にできないのか」を、根拠を持って書ける範囲でだけ書く。
///
/// 1. `ExpoGoogleMobileAdsModule.swift` の `getAnchoredAdaptiveSize` /
///    `getLargeAnchoredAdaptiveSize` / `getInlineAdaptiveSize`（3 箇所）。
///    JS API 上あえて同期関数にしている（呼び出し側がロード前にレイアウトを確定させるための
///    設計）ため非同期化できず、かつ `GADAdSize.h` がメインスレッド専用と明記しているため、
///    同期のまま main へ寄せる以外に手が無い。**JS スレッドが JS ランタイムを保持したまま
///    `main.sync` に到達しうるのは、この 3 箇所だけ**である（他の 2 箇所は下記のとおり JS の
///    同期呼び出し経路上に無い）。つまり上記の残存リスクを実際に負っているのはここだけであり、
///    承知の上で意図的に残している。受け入れる理由は、この呼び出しが短く・純粋な数値計算
///    だけで・JS へ再入することが無いため。
/// 2. `bannerView`（下記の遅延生成プロパティ）。`BannerView?` を返す必要があるので
///    `DispatchQueue.main.async` にはできない。grep で確認した呼び出し元は `load()` の
///    `DispatchQueue.main.async` ブロック（1 箇所）と `BannerAdView` の `setAd` /
///    `detachCurrentAdIfOwned` / `layoutSubviews` / `deinit`（`deinit` は `runOnMain` の中）
///    だけで、いずれも既にメインスレッド上にいる（`ExpoView = ExpoFabricView` が
///    `@MainActor` であることは `ExpoModulesCore.swiftinterface` で確認した）。
///    したがって実際には `Thread.isMainThread` の早期リターン分岐しか実行されない。
///    （`sharedObjectWillRelease` はこのプロパティではなく `_bannerView` を直接読んでいる。）
/// 3. `BannerAdView.deinit`（`BannerAdView.swift`）。ブロックが
///    `currentAd.currentAttachment === self` を比較するため、解放中の `self` を escaping
///    クロージャへ渡す `main.async` には**できない**（`runOnMain` のブロックは非 escaping
///    なので合法）。`deinit` がメインスレッドで呼ばれる保証は無いので、ここは 2. と違って
///    実際に `main.sync` 分岐へ入りうる。ただし `deinit` は ARC の解放時に走るのであって、
///    同期の `Function`/`Property` の本体として JS ランタイムを保持したまま走るわけではない。
///    上記の「JS ランタイムの奪い合い」というリスクの前提が成立しないので、1. とは別扱い。
///
/// なお `main.sync` を書いてよい場所とそうでない場所の区別は「呼び出し元がロックを持っているか」
/// では**ない**（JS ランタイム自体が競合資源なので、そのような安全性の主張はできない）。
/// ロックを保持したまま呼ばれることが分かっている `sharedObjectWillRelease()` のようなパスは
/// デッドロック確率が跳ね上がるので論外、というだけである（そちらは `DispatchQueue.main.async`。
/// 詳細はそのメソッドのコメントを参照）。
///
/// この方針で `main.sync` を外した箇所:
/// - `status`/`error`/`loadedSize`/`responseInfo` の読み取り（JS の render のたびに走るホット
///   パス）→ main を奪い合わない `NSLock` に置き換え、データ競合だけを閉じている。
/// - `load()` と `setRequestConfiguration`（`ExpoGoogleMobileAdsModule.swift`）→ どちらも戻り値の
///   無い同期 `Function` なので `DispatchQueue.main.async` で足りる。
func runOnMain<T>(_ block: () -> T) -> T {
  if Thread.isMainThread {
    return block()
  }
  return DispatchQueue.main.sync(execute: block)
}

/// `size` に数値の `width`/`height` が含まれていない場合のエラー。
/// 以前は `?? 0` で 0×0 のバナーへ静かに縮退していたが、設定ミスは呼び出し側に
/// 例外として伝えるべき（0×0 は原因の分からない「広告が表示されない」バグにしかならない）。
final class InvalidBannerSizeException: Exception, @unchecked Sendable {
  override var reason: String {
    "BannerAd の size には数値の width と height が必要です"
  }
}

/// ビュー階層に入れずに保持・ロードできる広告インスタンス。
/// `BannerAdView` がマウント時に `bannerView` を addSubview し、アンマウント時は
/// removeFromSuperview するだけ — 破棄はしない。これにより画面遷移をまたいで再利用できる。
///
/// `SharedObject`（expo-modules-core）は `NSObject` を継承しない Swift クラスであるため、
/// `NSObjectProtocol` を要求する ObjC プロトコルの `BannerViewDelegate` に直接は適合できない
/// （`cannot declare conformance to 'NSObjectProtocol' in Swift` でビルドエラーになる）。
/// そのため NSObject ベースの小さなプロキシ `BannerAdDelegateProxy` 経由でイベントを受け取る。
final class BannerAd: SharedObject {
  private var _bannerView: BannerView?

  /// `sharedObjectWillRelease()` によるテアダウンが済んだかどうか。true になったら
  /// 二度と `GADBannerView` を作り直さない。メインスレッド上のコード（`runOnMain` の
  /// 早期リターン経由、または `sharedObjectWillRelease` の `DispatchQueue.main.async`
  /// ブロック）からしか読み書きしないので、`_bannerView` と同じく main 上で直列化される。
  private var isReleased = false

  /// ビュー階層に入れずに保持する。表示時に BannerAdView が addSubview する。
  /// 破棄後（`release()` 済み）は `nil` を返し、二度と新しい `GADBannerView` を作らない
  /// —— そうしないと、release 済みの ad をまだ保持している View が再度 props を
  /// 受け取ったときに、空の（何もロードされていない）バナーを勝手に作り直して
  /// マウントしてしまう。
  ///
  /// 遅延生成にしているのは、`GADBannerView` の生成・設定がメインスレッド専用の UIKit/GMA API
  /// である一方、`Constructor` は JS へ同期的にオブジェクトを返す必要があり、初期化の中で
  /// メインスレッドへ同期ホップするのは（JS スレッド=メインスレッドの環境やテスト環境も
  /// 含めて）避けたいため。実際に必要になる `load()` / `BannerAdView` アタッチ時まで生成を遅らせる。
  var bannerView: BannerView? {
    runOnMain {
      if isReleased {
        return nil
      }
      if let existing = _bannerView {
        return existing
      }
      let view = BannerView(adSize: adSizeFor(cgSize: CGSize(width: adWidth, height: adHeight)))
      view.adUnitID = adUnitId
      view.delegate = delegateProxy
      // GMA では課金イベントはデリゲートではなくクロージャで通知される。
      view.paidEventHandler = { [weak self] value in
        self?.emit(event: "paid", payload: [
          "value": value.value.doubleValue,
          "currencyCode": value.currencyCode,
          "precision": adValuePrecisionToString(value.precision),
        ])
      }
      _bannerView = view
      return view
    }
  }

  /// 現在この広告を表示している BannerAdView。所有権の判定に使う（weak なので
  /// View が解放されれば自動的に nil になる）。
  weak var currentAttachment: BannerAdView?

  /// リクエストしたサイズ。JS 側の `ad.size` になる。
  let requestedSize: [String: Any?]

  private let adUnitId: String
  private let adWidth: Double
  private let adHeight: Double
  private let requestOptions: [String: Any?]?
  private let delegateProxy = BannerAdDelegateProxy()

  // status/error/loadedSize/responseInfo は BannerViewDelegate のコールバック（メインスレッド）
  // から書き込まれ、JS 側の Property getter から読み取られる（React の render のたびに走る
  // ホットパス）。以前は読み取り側を `runOnMain`（＝main.sync）でメインスレッドへ同期させていたが、
  // それは「JS スレッドが JS ランタイムを保持したまま main の完了を待つ」形になり、main が
  // 同じランタイムへ同期的に割り込む経路（`runOnMain` のコメント参照）とロック順序が衝突しうる
  // うえに、頻繁に呼ばれるパスをわざわざメインスレッドの詰まり具合に晒すことになる。
  // main を奪い合わない `NSLock` に置き換えて、データ競合だけを閉じる。
  private let stateLock = NSLock()
  private var _status: String = "loading"
  private var _error: [String: Any?]?
  private var _loadedSize: [String: Any?]?
  private var _responseInfo: [String: Any?]?

  var status: String {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _status
  }

  var error: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _error
  }

  var loadedSize: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _loadedSize
  }

  var responseInfo: [String: Any?]? {
    stateLock.lock()
    defer { stateLock.unlock() }
    return _responseInfo
  }

  init(adUnitId: String, size: [String: Any?], requestOptions: [String: Any?]?) throws {
    guard let width = size["width"] as? Double, let height = size["height"] as? Double else {
      throw InvalidBannerSizeException()
    }
    self.adWidth = width
    self.adHeight = height
    self.requestedSize = size
    self.adUnitId = adUnitId
    self.requestOptions = requestOptions
    super.init()
    delegateProxy.owner = self
  }

  /// JS からは同期関数として呼ばれるが（`Function("load")`、戻り値は無い）、中身は
  /// `DispatchQueue.main.async` に投げるだけ。以前は `runOnMain`（＝main.sync）で
  /// 呼び出しスレッドをブロックしていたが、`load()` は戻り値を必要としないので、
  /// わざわざ JS 側のスレッドを塞いでメインの完了を待つ理由が無い。
  func load() {
    DispatchQueue.main.async { [self] in
      guard let view = bannerView else {
        // release() 済み。もう表示するものが無いので何もしない。
        return
      }

      setStatus("loading", error: nil)

      // rootViewController は weak かつ「表示中の最前面 view controller」なので、init 時点で
      // 一度だけ解決して固定するとプリロード時（まだ view controller が存在しない）に nil の
      // ままになったり、後からモーダルが閉じて無効化されたりする。load() のたびに解決し直す。
      guard let rootViewController = resolveRootViewController() else {
        setStatus("error", error: [
          "code": -1,
          "message":
            "表示可能な view controller が見つからないため広告をロードできませんでした。"
            + "アプリの起動が完了してから、または BannerAdView をマウントしてから load() を呼び直してください。",
          "domain": "ExpoGoogleMobileAds",
        ])
        return
      }
      view.rootViewController = rootViewController

      let request = Request()
      if let keywords = requestOptions?["keywords"] as? [String] {
        request.keywords = keywords
      }
      if let contentUrl = requestOptions?["contentUrl"] as? String {
        request.contentURL = contentUrl
      }
      // networkExtras（アダプター固有の GADAdNetworkExtras）はメディエーションアダプター
      // 実装に依存するため未対応。特定のメディエーションを追加するタスクで実装する。
      view.load(request)
    }
  }

  /// 表示中の view controller をそのつど解決する。`BannerAdView` にまだマウントされていない
  /// （プリロード中の）場合は `Utilities.currentViewController()` がまだ何も返せないことがある
  /// ため、アプリのキーウィンドウの rootViewController にフォールバックする。
  private func resolveRootViewController() -> UIViewController? {
    if let vc = appContext?.utilities?.currentViewController() {
      return vc
    }
    return UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
      .first
  }

  /// status/error をロックの下でまとめて更新し、更新後の値で `statusChange` を発火する。
  private func setStatus(_ status: String, error: [String: Any?]?) {
    stateLock.lock()
    _status = status
    _error = error
    stateLock.unlock()
    emitStatusChange()
  }

  private func emitStatusChange() {
    emit(event: "statusChange", payload: ["status": status, "error": error as Any])
  }

  /// JS 側が `release()` を呼んで SharedObject の登録が解除される直前に呼ばれる。
  /// `release()` は JS との結びつきを切るだけでネイティブ側の後始末はしてくれないため、
  /// ここでデリゲートを外し、課金クロージャを外し、View から取り除く。View 側の
  /// `currentAd` プロパティ自体は（Fabric のリサイクルで prepareForRecycle が呼ばれても）
  /// 誰も明示的に nil にしてくれないままになり得るが、`bannerView` が `isReleased` を見て
  /// 二度と作り直さなくなるので、少なくともネイティブの広告表示・インプレッション計測・
  /// イベント発火・新しい `GADBannerView` の再生成は確実に止まる。
  ///
  /// **`runOnMain`（＝`DispatchQueue.main.sync`）を使ってはいけない**: `SharedObjectRegistry.delete`
  /// はレジストリの `Mutex`（`state.withLock`）を保持したままこのメソッドを呼ぶ
  /// （`SharedObjectRegistry.swift` の `delete(_:)` を参照）。一方、メインスレッドで
  /// `BannerAdView` に `ad` prop がセットされるときは `ExpoFabricViewObjC` の
  /// `updateProps` → `DynamicSharedObjectType.cast` → `registry.get` → 同じ `state.withLock`
  /// という経路で同じミューテックスを取りに行く。ここで `main.sync` を使うと
  /// 「JS スレッド: レジストリのロックを保持 → メインスレッドの完了待ち」
  /// 「メインスレッド: 別の広告のマウント処理でレジストリのロック待ち」という
  /// 逆向きの依存が同時に成立し得て、ロックの順序が反転してデッドロックする
  /// （ビルドはもちろん、ふつうの手動テストでも再現しにくく、アプリが無言でフリーズする）。
  ///
  /// そのため、テアダウンに必要な `self` への強参照だけをクロージャに持たせ、
  /// `DispatchQueue.main.async` で後始末をメインスレッドへ「投げっぱなし」にする。これにより
  /// このメソッド自身は一切ブロックせずに即座に返り、`state.withLock` はすぐに解放される
  /// （＝レジストリ側は誰の完了も待たない）。`_bannerView` の読み取りも（fix round 2 で
  /// 呼び出し元スレッドのまま読んでいたのを修正し）この async ブロックの中に移した ——
  /// 呼び出し元スレッド（JS スレッドであることが多い）から `_bannerView` を無同期で読むのは、
  /// メインスレッドからの書き込み（`bannerView` の遅延生成）とのデータ競合になるため。
  /// このメソッドが返った後もクロージャが `self` を保持する間は `BannerAd` も
  /// （そしてそれが持つ `GADBannerView` も）解放されず、async ブロックが実行されるまで
  /// 生存が保証される。この間に他から `_bannerView`/`currentAttachment`/`isReleased` を
  /// 触れるのはメインスレッド上のコードだけであり、それらは GCD のメインキュー上でこの async
  /// ブロックと直列化されるため、途中で不整合な状態を観測されることはない。
  ///
  /// なお `sharedObjectDidRelease()`（今は override していない）も同じ `state.withLock` の
  /// 中で呼ばれる（`SharedObjectRegistry.swift` の `delete(_:)` 参照）。将来 override する
  /// 場合も、ここと同じ理由で `runOnMain`/`main.sync` を使ってはいけない。
  override func sharedObjectWillRelease() {
    DispatchQueue.main.async { [self] in
      isReleased = true
      guard let view = _bannerView else { return }
      view.delegate = nil
      view.paidEventHandler = nil
      view.removeFromSuperview()
      currentAttachment = nil
      // GADBannerView（UIView）の最後の強参照をここで手放すことで、UIView の解放が
      // メインスレッド上で起きるようにする。
      _bannerView = nil
    }
  }

  // MARK: - BannerViewDelegate callbacks (forwarded from BannerAdDelegateProxy)
  // GMA はこれらのコールバックを常にメインスレッドで呼ぶため、追加の main ホップは不要。

  fileprivate func handleDidReceiveAd(_ bannerView: BannerView) {
    // GMA を叩く処理（`adSize` / `responseInfo` の読み取りと、`adNetworkInfoArray` を辿って
    // 辞書を組み立てる `responseInfoToDictionary`）はロックの外で先に済ませる。
    // `stateLock` は JS の render のたびに Property getter から取られるため、そこに
    // GMA の任意の処理と確保を挟みたくない。ロックは代入だけのために取る。
    let size: [String: Any?] = [
      "width": bannerView.adSize.size.width,
      "height": bannerView.adSize.size.height,
    ]
    let info = responseInfoToDictionary(bannerView.responseInfo)

    stateLock.lock()
    _status = "loaded"
    _loadedSize = size
    _responseInfo = info
    stateLock.unlock()
    emitStatusChange()
  }

  fileprivate func handleDidFailToReceiveAd(withError err: Error) {
    setStatus("error", error: errorToDictionary(err))
  }

  fileprivate func handleDidRecordImpression() {
    emit(event: "impression")
  }

  fileprivate func handleDidRecordClick() {
    emit(event: "clicked")
  }
}

/// `BannerViewDelegate`（ObjC プロトコル）は `NSObjectProtocol` を要求するため、
/// `NSObject` を継承しない `BannerAd`（SharedObject）は直接は適合できない。
/// この NSObject ベースのプロキシが受け取ったイベントを `owner` の `handle...` メソッドへ転送する。
private final class BannerAdDelegateProxy: NSObject, BannerViewDelegate {
  weak var owner: BannerAd?

  func bannerViewDidReceiveAd(_ bannerView: BannerView) {
    owner?.handleDidReceiveAd(bannerView)
  }

  func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
    owner?.handleDidFailToReceiveAd(withError: error)
  }

  func bannerViewDidRecordImpression(_ bannerView: BannerView) {
    owner?.handleDidRecordImpression()
  }

  func bannerViewDidRecordClick(_ bannerView: BannerView) {
    owner?.handleDidRecordClick()
  }
}
