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

function useBannerAdState(ad: BannerAd): BannerAdState {
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

/** ad を渡された側。既存の ad を購読するだけで、生成や解放は行わない。 */
function useExistingBannerAd(ad: BannerAd): BannerAdState {
  return useBannerAdState(ad);
}

/** options を渡された側。ad を生成し、アンマウント時に自動で release する。 */
function useCreatedBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd } {
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

function isOptions(value: BannerAd | BannerAdOptions): value is BannerAdOptions {
  return typeof (value as BannerAdOptions).adUnitId === 'string';
}

/**
 * バナー広告の読み込み状態を購読する。
 *
 * - `ad` を渡した場合: 既に生成済みの ad を購読するだけ。ad の生成/解放は呼び出し側の責任。
 * - `options` を渡した場合: ad をこの hook が生成し、アンマウント時に自動で release する。
 *
 * 呼び出す側は、渡す引数が `ad` か `options` かをコンポーネントの生存期間中に固定しなければならない。
 * （React の hooks 規則上、内部で呼ぶ hook を条件分岐で切り替えられないため。
 * 同じ呼び出し箇所で `ad` と `options` を行き来するのは誤用。）
 */
export function useBannerAd(ad: BannerAd): BannerAdState;
export function useBannerAd(options: BannerAdOptions): BannerAdState & { ad: BannerAd };
export function useBannerAd(
  adOrOptions: BannerAd | BannerAdOptions
): BannerAdState & { ad?: BannerAd } {
  // 呼び出し側は ad/options のどちらを渡すかを生存期間中に変えない前提のため、
  // 呼び出し順は実質的に固定される（JSDoc 参照）。
  if (isOptions(adOrOptions)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCreatedBannerAd(adOrOptions);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useExistingBannerAd(adOrOptions);
}
