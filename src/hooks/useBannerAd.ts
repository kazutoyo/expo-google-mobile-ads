import { useEvent } from 'expo';
import { useReleasingSharedObject } from 'expo-modules-core';

import type { BannerAd, BannerAdOptions } from '../BannerAd';
import type { BannerAdSize } from '../BannerAdSize';
import NativeModule from '../ExpoGoogleMobileAdsModule';
import { runWhenInitialized } from '../initialization';
import type { AdError } from '../types';

export type BannerAdState = {
  isLoaded: boolean;
  error?: AdError;
  loadedSize?: BannerAdSize;
};

/**
 * 既に生成済みの ad（例: `createBannerAd` で View の外で先読みした ad）を購読する。
 *
 * ad の生成・release は行わない。呼び出し側が ad のライフタイムを管理すること。
 */
export function useBannerAdState(ad: BannerAd): BannerAdState {
  const { status, error } = useEvent(ad, 'statusChange', {
    status: ad.status,
    error: ad.error,
  });

  return {
    isLoaded: status === 'loaded',
    error,
    loadedSize: ad.loadedSize,
  };
}

/**
 * バナー広告を生成し、アンマウント時に自動で release する。`useVideoPlayer` と同じ設計。
 *
 * `requestOptions` は生成時にのみ読み取られる。生成後に変更しても反映されない
 * （毎レンダーで新しいオブジェクト参照になりやすいため、依存配列には含めていない）。
 * 異なる requestOptions を使いたい場合は、この hook を呼び直して新しい ad を生成すること。
 */
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd } {
  const ad = useReleasingSharedObject<BannerAd>(() => {
    const created: BannerAd = new NativeModule.BannerAd(
      options.adUnitId,
      options.size,
      options.requestOptions
    );
    runWhenInitialized(() => created.load());
    return created;
  }, [options.adUnitId, options.size.width, options.size.height]);

  return { ...useBannerAdState(ad), ad };
}
