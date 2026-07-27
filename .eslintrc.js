module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'android/', 'ios/', 'dist/', '.expo/', 'supabase/'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
