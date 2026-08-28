Pod::Spec.new do |s|
  s.name           = 'ExpoGoogleMobileAds'
  s.version        = '0.1.0'
  s.summary        = 'Expo Module wrapping the Google Mobile Ads (AdMob) SDK'
  s.description    = 'Expo Module wrapping the Google Mobile Ads (AdMob) SDK'
  s.author         = 'Kazutoyo Tokai <tokai.kazutoyo@tellernovel.com>'
  s.homepage       = 'https://github.com/kazutoyo/expo-google-mobile-ads'
  # iOS only. Google-Mobile-Ads-SDK 13.x declares `platforms: { ios: 12.0 }` and ships no tvOS
  # slice, so declaring :tvos here only makes `pod install` fail for a tvOS target.
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/kazutoyo/expo-google-mobile-ads' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Google-Mobile-Ads-SDK', '~> 13.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
