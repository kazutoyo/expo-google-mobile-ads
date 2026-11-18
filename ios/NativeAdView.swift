import ExpoModulesCore
import GoogleMobileAds
import UIKit

/// Assets stay inside the SDK view, which owns click/impression tracking and AdChoices.
final class NativeAdCardView: ExpoView {
  private var currentAd: NativeAdObject?
  private let card = GoogleMobileAds.NativeAdView()
  private let stack = UIStackView()
  private let attribution = UILabel()
  private let headline = UILabel()
  private let advertiser = UILabel()
  private let body = UILabel()
  private let icon = UIImageView()
  private let media = MediaView()
  private let cta = UIButton(type: .system)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addSubview(card)
    card.addSubview(stack)
    stack.axis = .vertical
    stack.spacing = 6
    stack.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12)
    ])
    attribution.text = "Ad"
    attribution.font = .systemFont(ofSize: 12)
    headline.font = .boldSystemFont(ofSize: 17)
    body.numberOfLines = 2
    body.font = .systemFont(ofSize: 14)
    icon.contentMode = .scaleAspectFit
    let header = UIStackView(arrangedSubviews: [icon, headline])
    header.spacing = 8
    icon.widthAnchor.constraint(equalToConstant: 40).isActive = true
    icon.heightAnchor.constraint(equalToConstant: 40).isActive = true
    for view in [attribution, header, advertiser, media, body, cta] { stack.addArrangedSubview(view) }
    media.heightAnchor.constraint(greaterThanOrEqualToConstant: 120).isActive = true
    media.setContentHuggingPriority(.defaultLow, for: .vertical)
    cta.isUserInteractionEnabled = false
    card.headlineView = headline
    card.advertiserView = advertiser
    card.bodyView = body
    card.iconView = icon
    card.mediaView = media
    card.callToActionView = cta
    card.isHidden = true
  }

  func setAd(_ ad: NativeAdObject?) {
    if currentAd?.attachment === self { currentAd?.attachment = nil }
    // One ad is attached to one card. The old card must stop rendering before reassignment.
    if let previous = ad?.attachment, previous !== self { previous.setAd(nil) }
    currentAd = ad
    ad?.attachment = self
    refresh()
  }

  func refresh() {
    guard let ad = currentAd?.ad else { card.nativeAd = nil; card.isHidden = true; return }
    var controller = window?.rootViewController
    while let presented = controller?.presentedViewController { controller = presented }
    ad.rootViewController = controller
    if card.nativeAd === ad { return }
    card.nativeAd = nil
    headline.text = ad.headline
    advertiser.text = ad.advertiser
    advertiser.isHidden = ad.advertiser == nil
    body.text = ad.body
    body.isHidden = ad.body == nil
    icon.image = ad.icon?.image
    icon.isHidden = ad.icon == nil
    media.mediaContent = ad.mediaContent
    cta.setTitle(ad.callToAction, for: .normal)
    cta.isHidden = ad.callToAction == nil
    card.nativeAd = ad
    card.isHidden = false
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { refresh() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    card.frame = bounds
  }
}
