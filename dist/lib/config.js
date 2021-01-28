"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigSync = exports.getConfigPath = exports.buildConfig = void 0;
const path_1 = require("path");
const yaml_1 = require("yaml");
const string_env_interpolation_1 = require("string-env-interpolation");
const consts_1 = require("./consts");
const file_1 = require("./file");
const hash_1 = require("./hash");
const print_1 = require("./print");
function buildConfig(raw) {
    if (typeof raw !== 'object')
        print_1.printError(new Error('A config file must shape an object'));
    if (!raw.schema || !raw.documents || !raw.plugins)
        print_1.printError(new Error(`A config requires a "${name}" field`));
    const documents = Array.isArray(raw.documents)
        ? raw.documents
        : typeof raw.documents === 'string'
            ? [raw.documents]
            : print_1.printError(new Error(`config.documents should be an array or a string`));
    return {
        ...raw,
        // Normalized codegen options
        documents,
        // Set graphql-let default values
        respectGitIgnore: raw.respectGitIgnore !== undefined ? raw.respectGitIgnore : true,
        cacheDir: raw.cacheDir || 'node_modules/graphql-let/__generated__',
        TSConfigFile: raw.TSConfigFile || 'tsconfig.json',
        gqlDtsEntrypoint: raw.gqlDtsEntrypoint || 'node_modules/@types/graphql-let/index.d.ts',
        generateOptions: raw.generateOptions || Object.create(null),
        schemaEntrypoint: raw.schemaEntrypoint || '',
    };
}
exports.buildConfig = buildConfig;
const getConfigPath = (cwd, configFilePath) => path_1.resolve(cwd, configFilePath || consts_1.DEFAULT_CONFIG_FILENAME);
exports.getConfigPath = getConfigPath;
const getConfigFromContent = (content) => {
    content = string_env_interpolation_1.env(content);
    return [buildConfig(yaml_1.parse(content)), hash_1.createHash(content)];
};
async function loadConfig(cwd, configFilePath) {
    const configPath = exports.getConfigPath(cwd, configFilePath);
    const content = await file_1.readFile(configPath, 'utf-8');
    return getConfigFromContent(content);
}
exports.default = loadConfig;
function loadConfigSync(cwd, configFilePath) {
    const configPath = exports.getConfigPath(cwd, configFilePath);
    const content = file_1.readFileSync(configPath, 'utf-8');
    return getConfigFromContent(content);
}
exports.loadConfigSync = loadConfigSync;
