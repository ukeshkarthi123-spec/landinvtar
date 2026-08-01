module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Remove console.log in production
      ...(process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []),
    ],
  };
};
