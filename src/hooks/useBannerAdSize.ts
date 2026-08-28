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
  // `maxHeight` only exists on the inlineAdaptive member of the union, `orientation` only on
  // the other two, so both have to be read through a type guard.
  const maxHeight = spec.type === 'inlineAdaptive' ? spec.maxHeight : undefined;
  const orientation = spec.type === 'inlineAdaptive' ? undefined : spec.orientation;

  return useMemo(
    () => BannerAdSize.resolve(spec),
    // Recalculate whenever the screen size changes
    [width, height, spec.type, spec.width, orientation, maxHeight]
  );
}
