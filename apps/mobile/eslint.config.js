// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const RN_MAPS_FILE = 'src/features/venues/VenueMap.tsx';
const MAPLIBRE_FILE = 'src/features/venues/VenueMap.web.tsx';

const RN_MAPS_MESSAGE = `react-native-maps may only be imported in ${RN_MAPS_FILE}. Use <VenueMap> from '@/features/venues'.`;
const MAPLIBRE_MESSAGE = `maplibre-gl may only be imported in ${MAPLIBRE_FILE}. Use <VenueMap> from '@/features/venues'.`;

/** Builds the map-library import ban; `allow` lifts it for the one file that owns that library. */
function mapImportRule(allow) {
  const paths = [];
  const patterns = [];
  if (allow !== 'react-native-maps') {
    paths.push({ name: 'react-native-maps', message: RN_MAPS_MESSAGE });
    patterns.push({ group: ['react-native-maps/*'], message: RN_MAPS_MESSAGE });
  }
  if (allow !== 'maplibre-gl') {
    paths.push({ name: 'maplibre-gl', message: MAPLIBRE_MESSAGE });
    patterns.push({ group: ['maplibre-gl/*'], message: MAPLIBRE_MESSAGE });
  }
  return { 'no-restricted-imports': ['error', { paths, patterns }] };
}

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-*/*', 'public/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: mapImportRule(null),
  },
  {
    files: [RN_MAPS_FILE],
    rules: mapImportRule('react-native-maps'),
  },
  {
    files: [MAPLIBRE_FILE],
    rules: mapImportRule('maplibre-gl'),
  },
]);
