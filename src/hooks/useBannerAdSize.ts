import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { BannerAdSize, type BannerAdSizeSpec } from '../BannerAdSize';

/**
 * Recalculates the banner size as the screen orientation or width changes.
 *
 * Use this hook when spec's orientation is 'current', since the height can change on
 * rotation.
 */
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize {
  const { width, height } = useWindowDimensions();
  const maxHeight = spec.type === 'inlineAdaptive' ? spec.maxHeight : undefined;

  return useMemo(
    () => BannerAdSize.resolve(spec),
    // Recalculate whenever the screen size changes
    [width, height, spec.type, spec.width, spec.orientation, maxHeight]
  );
}
