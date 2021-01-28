"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLiteralsForContext = exports.processLiteralsWithDtsGenerate = exports.processLiterals = void 0;
const core_1 = require("@babel/core");
const traverse_1 = __importDefault(require("@babel/traverse"));
const make_dir_1 = __importDefault(require("make-dir"));
const path_1 = require("path");
const fs_1 = require("fs");
const slash_1 = __importDefault(require("slash"));
const babel_1 = require("../../babel");
const config_1 = __importDefault(require("../config"));
const documents_1 = require("../documents");
const dts_1 = require("../dts");
const exec_context_1 = __importDefault(require("../exec-context"));
const file_1 = require("../file");
const graphql_1 = require("graphql");
const parser_1 = require("@babel/parser");
const file_2 = require("../file");
const path_2 = require("path");
const hash_1 = require("../hash");
const resolver_types_1 = require("../resolver-types");
const cache_1 = require("./cache");
const fns_1 = require("./fns");
async function processLiterals(execContext, sourceRelPath, schemaHash, gqlContents, codegenContext, partialCache) {
    const { cwd, config, cacheFullDir } = execContext;
    const dtsRelDir = path_1.dirname(config.gqlDtsEntrypoint);
    const literalCodegenContext = [];
    const oldGqlHashes = new Set(Object.keys(partialCache));
    // Prepare
    await Promise.all([
        await make_dir_1.default(path_2.join(cwd, dtsRelDir)),
        await make_dir_1.default(cacheFullDir),
    ]);
    for (const gqlContent of gqlContents) {
        const strippedGqlContent = graphql_1.stripIgnoredCharacters(gqlContent);
        const gqlHash = hash_1.createHash(schemaHash + strippedGqlContent);
        const createdPaths = fns_1.createPaths(sourceRelPath, gqlHash, dtsRelDir, cacheFullDir, cwd);
        const context = {
            ...createdPaths,
            gqlContent,
            strippedGqlContent,
            gqlHash,
            skip: Boolean(partialCache[gqlHash]),
            dtsContentDecorator: fns_1.appendExportAsObject,
        };
        codegenContext.push(context);
        literalCodegenContext.push(context);
        // Note: Non-stripped gqlContent is necessary
        // to write dtsEntrypoint.
        partialCache[gqlHash] = [slash_1.default(createdPaths.dtsRelPath), gqlContent];
        // Old caches left will be removed
        oldGqlHashes.delete(gqlHash);
    }
    // Run codegen to write .tsx
    await documents_1.processGraphQLCodegenForLiterals(execContext, literalCodegenContext, sourceRelPath);
    // Remove old caches
    for (const oldGqlHash of oldGqlHashes) {
        delete partialCache[oldGqlHash];
        const { dtsFullPath } = fns_1.createPaths(sourceRelPath, oldGqlHash, dtsRelDir, cacheFullDir, cwd);
        if (fs_1.existsSync(dtsFullPath)) {
            await file_1.rimraf(dtsFullPath);
        }
    }
}
exports.processLiterals = processLiterals;
// Used in babel.ts
async function processLiteralsWithDtsGenerate(literalsArgs) {
    const { cwd, configFilePath, sourceRelPath, gqlContents } = literalsArgs;
    const [config, configHash] = await config_1.default(cwd, configFilePath);
    const execContext = exec_context_1.default(cwd, config, configHash);
    let schemaHash = configHash;
    if (resolver_types_1.shouldGenResolverTypes(config)) {
        schemaHash = await resolver_types_1.createSchemaHash(execContext);
    }
    const codegenContext = [];
    const cache = new cache_1.LiteralCache(execContext);
    await cache.load();
    await processLiterals(execContext, sourceRelPath, schemaHash, gqlContents, codegenContext, cache.get(sourceRelPath));
    await cache.unload();
    await dts_1.processDtsForContext(execContext, codegenContext);
    return codegenContext;
}
exports.processLiteralsWithDtsGenerate = processLiteralsWithDtsGenerate;
async function processLiteralsForContext(execContext, schemaHash, sourceRelPaths, codegenContext) {
    if (!sourceRelPaths.length)
        return;
    const { cwd } = execContext;
    const babelOptions = await core_1.loadOptions({ cwd, filename: '' });
    const { 
    // configFilePath,
    importName = 'graphql-let', onlyMatchImportSuffix = false, } = babel_1.getGraphQLLetBabelOption(babelOptions);
    const visitedSources = [];
    for (const sourceRelPath of sourceRelPaths) {
        const sourceFullPath = path_1.join(cwd, sourceRelPath);
        const sourceContent = await file_2.readFile(path_1.join(cwd, sourceRelPath), 'utf-8');
        const sourceAST = parser_1.parse(sourceContent, fns_1.parserOption);
        traverse_1.default(sourceAST, {
            Program(programPath) {
                const visitLiteralCallResults = babel_1.visitLiteralCalls(programPath, importName, onlyMatchImportSuffix);
                // TODO: Handle error
                // There's no `gql(`query {}`)` in the source
                if (!visitLiteralCallResults.literalCallExpressionPaths.length)
                    return;
                visitedSources.push({
                    visitLiteralCallResults,
                    programPath,
                    sourceFullPath,
                    sourceRelPath,
                });
            },
        });
    }
    const cache = new cache_1.LiteralCache(execContext);
    await cache.load();
    for (const visited of visitedSources) {
        const scopedCodegenContext = [];
        const { visitLiteralCallResults, programPath, sourceFullPath, sourceRelPath, } = visited;
        const { literalCallExpressionPaths } = visitLiteralCallResults;
        const gqlContents = literalCallExpressionPaths.map(([, value]) => value);
        await processLiterals(execContext, sourceRelPath, schemaHash, gqlContents, scopedCodegenContext, cache.get(sourceRelPath));
        babel_1.modifyLiteralCalls(programPath, sourceFullPath, visitLiteralCallResults, scopedCodegenContext);
        for (const context of scopedCodegenContext)
            codegenContext.push(context);
    }
    await cache.unload();
}
exports.processLiteralsForContext = processLiteralsForContext;
