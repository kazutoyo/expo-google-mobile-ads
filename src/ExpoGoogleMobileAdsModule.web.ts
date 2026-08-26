import { registerWebModule, NativeModule } from 'expo';

// ExpoGoogleMobileAdsModule is not available on the web platform.
class ExpoGoogleMobileAdsModule extends NativeModule<{}> {}

export default registerWebModule(ExpoGoogleMobileAdsModule, 'ExpoGoogleMobileAdsModule');
