const config = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  stories: ['../stories/*.stories.jsx'],
  addons: ['@storybook/addon-links'],
  webpackFinal: async (webpackConfig) => {
    webpackConfig.module.rules.push({
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
      },
    });
    return webpackConfig;
  },
};

export default config;
