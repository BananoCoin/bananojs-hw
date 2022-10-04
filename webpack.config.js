const path = require('path');

module.exports = {
  mode: 'production',
  entry: './webpack/TransportWebUSB.js',
  output: {
    filename: 'TransportWebUSB.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
