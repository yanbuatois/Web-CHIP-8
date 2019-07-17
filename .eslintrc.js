module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'max-len': 'off',
    'no-bitwise': 'off',
    'no-plusplus': 'off',
    'class-methods-use-this': 'off',
    'one-var': 'off',
    'one-var-declaration-per-line': 'off',
  },
};
