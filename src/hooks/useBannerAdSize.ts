import { useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

import { BannerAdSize, type BannerAdSizeSpec } from '../BannerAdSize';

/**
 * 画面の向きや幅の変化に追従してバナーサイズを再計算する。
 *
 * spec の orientation が 'current' の場合、回転時に高さが変わりうるためこの hook を使う。
 *
 * `BannerAdSize.resolve()` はネイティブ関数を呼ぶため例外を投げうる
 * （例: Android の `getAnchoredAdaptiveSize` 等は UI スレッドが応答しない場合に
 * `ERR_UI_THREAD_UNRESPONSIVE` を投げる。iOS の対応する呼び出しはこのケースでは
 * 失敗しないため、プラットフォーム間で契約が完全には揃っていない）。この hook は
 * レンダー中に呼ばれる `useMemo` の中で呼ぶため、例外をそのまま投げると
 * 画面ごとクラッシュする。ここで捕まえ、直前に成功したサイズ（無ければ
 * `BannerAdSize.BANNER` という既定値）へフォールバックする。
 */
export function useBannerAdSize(spec: BannerAdSizeSpec): BannerAdSize {
  const { width, height } = useWindowDimensions();
  const maxHeight = spec.type === 'inlineAdaptive' ? spec.maxHeight : undefined;
  const lastKnownGoodSize = useRef<BannerAdSize | null>(null);

  return useMemo(() => {
    try {
      const size = BannerAdSize.resolve(spec);
      lastKnownGoodSize.current = size;
      return size;
    } catch (error) {
      const fallback = lastKnownGoodSize.current ?? BannerAdSize.BANNER;
      if (__DEV__) {
        console.warn(
          '[expo-google-mobile-ads] バナーサイズの計算に失敗しました。' +
            `${lastKnownGoodSize.current ? '直前のサイズ' : '既定値 BannerAdSize.BANNER'}へフォールバックします。`,
          error
        );
      }
      return fallback;
    }
    // 画面サイズが変わったら再計算する
  }, [width, height, spec.type, spec.width, spec.orientation, maxHeight]);
}
