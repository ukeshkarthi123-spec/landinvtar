const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable CSS for web and handle React 19 / SDK 54 modern features
config.transformer.minifierPath = 'metro-minify-terser';
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Exclude web-only and duplicate directories from Metro's scanning
config.resolver.blockList = [
  /web_next\/.*/,
  /admin\/.*/,
  /landinvtar\/.*/,
];

module.exports = config;
