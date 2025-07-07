const config = {
    testMatch: [
        "**/Test/Backend/**/*.test.js"
    ],
    setupFilesAfterEnv: [
        "<rootDir>/jest.setup.js"
    ],
    testEnvironment: "node",
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
    collectCoverage: false,
    coverageDirectory: "coverage"
};

export default config;