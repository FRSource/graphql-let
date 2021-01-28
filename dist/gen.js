"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globby_1 = __importDefault(require("globby"));
const log_update_1 = __importDefault(require("log-update"));
const documents_1 = require("./lib/documents");
const dts_1 = require("./lib/dts");
const exec_context_1 = __importDefault(require("./lib/exec-context"));
const config_1 = __importDefault(require("./lib/config"));
const literals_1 = require("./lib/literals/literals");
const print_1 = require("./lib/print");
const resolver_types_1 = require("./lib/resolver-types");
const file_1 = require("./lib/file");
const path_1 = require("path");
async function removeOldTsxCaches(execContext, codegenContext) {
    const { cacheFullDir } = execContext;
    const validTsxs = new Set(codegenContext.map(({ tsxFullPath }) => tsxFullPath));
    const oldTsxPaths = await globby_1.default([path_1.join(cacheFullDir, '/**/*.ts'), path_1.join(cacheFullDir, '/**/*.tsx')], { absolute: true });
    await Promise.all(oldTsxPaths.filter((e) => !validTsxs.has(e)).map((e) => file_1.rimraf(e)));
}
async function gen({ cwd, configFilePath, }) {
    print_1.updateLog('Running graphql-codegen...');
    const [config, configHash] = await config_1.default(cwd, configFilePath);
    const execContext = exec_context_1.default(cwd, config, configHash);
    const codegenContext = [];
    const { graphqlRelPaths, tsSourceRelPaths } = await documents_1.findTargetDocuments(execContext);
    const { schemaHash } = await resolver_types_1.processResolverTypesIfNeeded(execContext, codegenContext);
    await documents_1.processDocumentsForContext(execContext, schemaHash, codegenContext, graphqlRelPaths);
    await literals_1.processLiteralsForContext(execContext, schemaHash, tsSourceRelPaths, codegenContext);
    print_1.updateLog('Generating .d.ts...');
    await dts_1.processDtsForContext(execContext, codegenContext);
    await removeOldTsxCaches(execContext, codegenContext);
    if (codegenContext.filter((e) => !e.skip).length) {
        print_1.updateLog(`${codegenContext.length} .d.ts were generated.`);
    }
    else {
        print_1.updateLog(`Done nothing, caches are fresh.`);
    }
    log_update_1.default.done();
    return codegenContext;
}
exports.default = gen;
