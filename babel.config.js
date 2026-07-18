module.exports = function (api) {
  api.cache(true);
  require('dotenv').config();
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
