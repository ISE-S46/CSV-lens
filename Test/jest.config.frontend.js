const config = {
    fakeTimers: {
        enableGlobally: true,
    },
    testMatch: [
        "**/Test/Frontend/**/*.test.js"
    ],
    setupFilesAfterEnv: [
        "<rootDir>/jest.setup.js"
    ],
    testEnvironment: "jsdom",
    transform: {
        "^.+\\.js$": "babel-jest"
    },
    transformIgnorePatterns: [
        "node_modules/(?!.*\\.mjs$)"
    ],
    moduleFileExtensions: [
        "js",
        "json",
        "node"
    ],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/Frontend/$1"
    },
    collectCoverage: false,
    coverageDirectory: "coverage-frontend" // separate coverage for frontend
};

export default config;