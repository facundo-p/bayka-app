const upstreamTransformer = require('@expo/metro-config/babel-transformer');
const fs = require('fs');

module.exports.transform = async function transform({ src, filename, options }) {
  if (filename.endsWith('.sql')) {
    // Read the raw SQL file and export it as a string
    const sqlContent = fs.readFileSync(filename, 'utf8');
    const escaped = JSON.stringify(sqlContent);
    const code = `module.exports = ${escaped};`;
    return upstreamTransformer.transform({
      src: code,
      filename,
      options,
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
