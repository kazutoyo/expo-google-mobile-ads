import { defineConfig } from 'blume';

export default defineConfig({
  title: '@kazutoyo/expo-google-mobile-ads',
  description:
    'An Expo Modules native wrapper for the Google Mobile Ads (AdMob) SDK — banner, interstitial and rewarded ads, and UMP consent.',

  github: {
    owner: 'kazutoyo',
    repo: 'expo-google-mobile-ads',
    branch: 'main',
  },

  deployment: {
    // A GitHub Pages project site: the whole thing is served from a subpath.
    site: 'https://kazutoyo.github.io',
    base: '/expo-google-mobile-ads',
  },

  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' },
    ],
  },
});
