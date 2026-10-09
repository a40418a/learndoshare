const { defineConfig } = require('eslint/config');
const eslintJs = require('@eslint/js');
const jestPlugin = require('eslint-plugin-jest');
const auraConfig = require('@salesforce/eslint-plugin-aura');
const lwcConfig = require('@salesforce/eslint-config-lwc/recommended');
const lwcTsConfig = require('@salesforce/eslint-config-lwc/recommended-ts');
const globals = require('globals');

module.exports = defineConfig([
    // Aura configuration
    {
        files: ['**/aura/**/*.js'],
        extends: [
            ...auraConfig.configs.recommended,
            ...auraConfig.configs.locker
        ]
    },

    // LWC configuration
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig]
    },
    {
        files: ['**/lwc/**/*.ts'],
        extends: [lwcTsConfig],
        // babel 파서는 타입 이름(Record, type의 속성 이름)을 변수로 본다. 같은 검사는 tsc가 한다
        // (tsconfig.lwc.base.json의 strict·noUnusedLocals·noUnusedParameters)
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off'
        }
    },

    // LWC configuration with override for LWC test files
    {
        files: ['**/lwc/**/*.test.{js,ts}'],
        rules: {
            '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },

    // Jest mocks configuration
    {
        files: ['**/jest-mocks/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 'latest',
            globals: {
                ...globals.node,
                ...globals.es2021,
                ...jestPlugin.environments.globals.globals
            }
        },
        plugins: {
            eslintJs
        },
        extends: ['eslintJs/recommended']
    }
]);