const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};
// Transform .sql files to export their content as a string
const defaultTransformerPath = config.transformer.babelTransformerPath;
config.transformer.babelTransformerPath = require.resolve('./sql-transformer.js');
config.transformer._defaultTransformerPath = defaultTransformerPath;
module.exports = config;
