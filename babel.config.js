module.exports = function (api) {
  api.cache(true);

  try {
    require('dotenv').config();
  } catch {
    // Optional dependency; ignore when dotenv is unavailable.
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
