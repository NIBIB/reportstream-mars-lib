module.exports = {
  // preset: 'ts-jest',
  transform: {
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest'
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testRegex: [
    '/tests/.*\\.(ts|mjs)$',
    '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    '.*Tests\\.(ts|mjs)$'
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'mjs', 'ts', 'tsx']
}
