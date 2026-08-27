import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { BannerAdSize, type BannerAdSizeSpec } from '../BannerAdSize';

/**
 * 画面の向きや幅の変化に追従してバナーサイズを再計算する。
 *
 * spec の orientation が 'current' の場合、回転時に高さが変わりうるためこの hook を使う。
 */
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize {
  const { width, height } = useWindowDimensions();
  const maxHeight = spec.type === 'inlineAdaptive' ? spec.maxHeight : undefined;

  return useMemo(
    () => BannerAdSize.resolve(spec),
    // 画面サイズが変わったら再計算する
    [width, height, spec.type, spec.width, spec.orientation, maxHeight]
  );
}
