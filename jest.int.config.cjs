/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@/(.*)\\.js$": "<rootDir>/src/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@tests/(.*)\\.js$": "<rootDir>/tests/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { useESM: true, tsconfig: "<rootDir>/tsconfig.json" },
    ],
  },
  testMatch: ["<rootDir>/tests/integration/**/*.int.test.ts"],
  testTimeout: 60000,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  maxWorkers: 1,
};
