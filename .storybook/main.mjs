/** @type { import('@storybook/react-webpack5').StorybookConfig } */
const config = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  stories: ['../stories/*.stories.jsx'],
  addons: [
    '@storybook/addon-webpack5-compiler-babel',
  ],
};

export default config;
