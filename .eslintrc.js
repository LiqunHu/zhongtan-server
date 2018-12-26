// https://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  globals: {
    arguments: true,
    describe: true,
    it: true
  },
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    es6: true,
    node: true
  },
  // https://github.com/standard/standard/blob/master/docs/RULES-en.md
  extends: 'eslint:recommended',
  // required to lint *.js files
  plugins: [],
  // add your custom rules here
  rules: {}
}
