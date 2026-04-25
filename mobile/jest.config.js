module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@react-native|react-native)/)'],
};
