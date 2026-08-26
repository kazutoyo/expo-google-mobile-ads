import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoGoogleMobileAdsModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoGoogleMobileAdsModule>('ExpoGoogleMobileAds');
