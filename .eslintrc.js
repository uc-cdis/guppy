module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: ['airbnb', 'plugin:storybook/recommended'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: ['react'],
  rules: {
    'no-underscore-dangle': 'off',
    'react/destructuring-assignment': 'off',
    'react/no-array-index-key': 'off',
    "import/no-extraneous-dependencies": ["error", {
      "devDependencies": true
    }]
  },
  overrides: [{
    "files": ["src/**/*.test.js"],
    "rules": {
      "no-undef": "off"
    }
  }]
};
