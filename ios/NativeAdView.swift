import ExpoModulesCore
import GoogleMobileAds
import UIKit

enum NativeAdLayout: String {
  case card
  case fullScreen
}

/// Assets stay inside the SDK view, which owns click/impression tracking and AdChoices.
final class NativeAdCardView: ExpoView {
  private var currentAd: NativeAdObject?
  private var layout = NativeAdLayout.card
  private var bottomInset: CGFloat = 0
  private let card = GoogleMobileAds.NativeAdView()
  // Holds only this view's subviews, so rebuilding a layout leaves the SDK's own subviews alone.
  private var content = UIView()
  private var gradientBottom: NSLayoutConstraint?
  private var headline = UILabel()
  private var advertiser = UILabel()
  private var body = UILabel()
  private var icon = UIImageView()
  private var media = MediaView()
  private var cta = UIButton(type: .system)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addSubview(card)
    card.isHidden = true
    buildLayout()
  }

  func setLayout(_ layout: NativeAdLayout) {
    guard layout != self.layout else { return }

    self.layout = layout
    card.nativeAd = nil
    buildLayout()
    refresh()
  }

  func setBottomInset(_ bottomInset: CGFloat) {
    self.bottomInset = bottomInset
    gradientBottom?.constant = -bottomInset
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
    switch layout {
    case .card:
      body.text = ad.body
      body.isHidden = ad.body == nil
      cta.setTitle(ad.callToAction, for: .normal)
    case .fullScreen:
      body.text = ad.body ?? ad.advertiser
      // setTitle(_:for:) would bypass the configuration's title font.
      cta.configuration?.title = ad.callToAction
    }
    icon.image = ad.icon?.image
    icon.isHidden = ad.icon == nil
    media.mediaContent = ad.mediaContent
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

  private func buildLayout() {
    content.removeFromSuperview()
    content = UIView()
    content.translatesAutoresizingMaskIntoConstraints = false
    card.insertSubview(content, at: 0)
    NSLayoutConstraint.activate([
      content.leadingAnchor.constraint(equalTo: card.leadingAnchor),
      content.trailingAnchor.constraint(equalTo: card.trailingAnchor),
      content.topAnchor.constraint(equalTo: card.topAnchor),
      content.bottomAnchor.constraint(equalTo: card.bottomAnchor)
    ])
    headline = UILabel()
    advertiser = UILabel()
    body = UILabel()
    icon = UIImageView()
    media = MediaView()
    cta = UIButton(type: .system)
    cta.isUserInteractionEnabled = false
    switch layout {
    case .card:
      buildCardLayout()
      card.advertiserView = advertiser
    case .fullScreen:
      buildFullScreenLayout()
      card.advertiserView = nil
    }
    card.headlineView = headline
    card.bodyView = body
    card.iconView = icon
    card.mediaView = media
    card.callToActionView = cta
  }

  private func buildCardLayout() {
    gradientBottom = nil
    let stack = UIStackView()
    content.addSubview(stack)
    stack.axis = .vertical
    stack.spacing = 6
    stack.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 12),
      stack.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -12),
      stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 12),
      stack.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -12)
    ])
    let attribution = UILabel()
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
  }

  /// Media fills the view. A gradient and an install card sit at the bottom, above `bottomInset`.
  private func buildFullScreenLayout() {
    let gradient = GradientView()
    let installCard = UIView()
    installCard.backgroundColor = .systemBackground
    installCard.layer.cornerRadius = 12
    installCard.layer.shadowColor = UIColor.black.cgColor
    installCard.layer.shadowOpacity = 0.18
    installCard.layer.shadowRadius = 10
    installCard.layer.shadowOffset = CGSize(width: 0, height: 4)
    media.contentMode = .scaleAspectFill
    media.clipsToBounds = true
    icon.contentMode = .scaleAspectFit
    icon.layer.cornerRadius = 8
    icon.clipsToBounds = true
    headline.font = .systemFont(ofSize: 15, weight: .bold)
    headline.textColor = .label
    body.font = .systemFont(ofSize: 12)
    body.textColor = .secondaryLabel
    var configuration = UIButton.Configuration.filled()
    configuration.baseBackgroundColor = .systemBlue
    configuration.baseForegroundColor = .white
    configuration.background.cornerRadius = 16
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 14, bottom: 8, trailing: 14)
    configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
      var attributes = attributes
      attributes.font = .systemFont(ofSize: 13, weight: .bold)
      return attributes
    }
    cta.configuration = configuration
    for view in [media, gradient, installCard] { content.addSubview(view) }
    for view in [icon, headline, body, cta] { installCard.addSubview(view) }
    for view in [media, gradient, installCard, icon, headline, body, cta] {
      view.translatesAutoresizingMaskIntoConstraints = false
    }
    let gradientBottom = gradient.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -bottomInset)
    self.gradientBottom = gradientBottom
    NSLayoutConstraint.activate([
      media.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      media.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      media.topAnchor.constraint(equalTo: content.topAnchor),
      media.bottomAnchor.constraint(equalTo: content.bottomAnchor),
      gradient.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      gradient.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      gradient.heightAnchor.constraint(equalToConstant: 180),
      gradientBottom,
      installCard.leadingAnchor.constraint(equalTo: content.safeAreaLayoutGuide.leadingAnchor, constant: 16),
      installCard.trailingAnchor.constraint(equalTo: content.safeAreaLayoutGuide.trailingAnchor, constant: -16),
      installCard.bottomAnchor.constraint(equalTo: gradient.bottomAnchor, constant: -8),
      installCard.heightAnchor.constraint(equalToConstant: 72),
      icon.leadingAnchor.constraint(equalTo: installCard.leadingAnchor, constant: 12),
      icon.centerYAnchor.constraint(equalTo: installCard.centerYAnchor),
      icon.widthAnchor.constraint(equalToConstant: 48),
      icon.heightAnchor.constraint(equalToConstant: 48),
      cta.trailingAnchor.constraint(equalTo: installCard.trailingAnchor, constant: -12),
      cta.centerYAnchor.constraint(equalTo: installCard.centerYAnchor),
      cta.heightAnchor.constraint(equalToConstant: 36),
      headline.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
      headline.trailingAnchor.constraint(equalTo: cta.leadingAnchor, constant: -12),
      headline.topAnchor.constraint(equalTo: installCard.topAnchor, constant: 14),
      body.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
      body.trailingAnchor.constraint(equalTo: cta.leadingAnchor, constant: -12),
      body.topAnchor.constraint(equalTo: headline.bottomAnchor, constant: 2)
    ])
  }
}

private final class GradientView: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    (layer as? CAGradientLayer)?.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.55).cgColor]
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}
