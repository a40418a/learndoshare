const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  // CSS 만 있는 모듈(@import 'c/slackTokens')은 기본 resolver 가 .js 를 찾다 실패한다
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    "^c/slackTokens$":
      "<rootDir>/force-app/main/default/lwc/slackTokens/slackTokens.css"
  },
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver"]
};
