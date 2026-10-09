const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    // tests/는 node:test 스위트다 (node --test로 실행)
    testPathIgnorePatterns: [...jestConfig.testPathIgnorePatterns, '<rootDir>/tests/']
};
