const config = {
  // Required
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  stories: ['../stories/*.stories.jsx'],
  // Optional
  addons: ['@storybook/addon-actions', '@storybook/addon-links'],
};

export default config;
