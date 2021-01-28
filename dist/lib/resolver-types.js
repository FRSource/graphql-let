"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processResolverTypesIfNeeded = exports.createSchemaHash = exports.shouldGenResolverTypes = void 0;
const globby_1 = __importDefault(require("globby"));
const slash_1 = __importDefault(require("slash"));
const file_1 = require("./file");
const hash_1 = require("./hash");
const paths_1 = require("./paths");
const print_1 = require("./print");
const graphql_codegen_1 = require("./graphql-codegen");
const p_map_1 = __importDefault(require("p-map"));
function shouldGenResolverTypes(config) {
    try {
        if (!config.schemaEntrypoint)
            return false;
        require('@graphql-codegen/typescript');
        require('@graphql-codegen/typescript-resolvers');
        const hasFilePointer = getSchemaPointers(config.schema).some((p) => !paths_1.isURL(p));
        if (!hasFilePointer) {
            print_1.printError(new Error(`To use Resolver Types, you should have at least one file in "schema".`));
            return false;
        }
        return true;
    }
    catch (e) {
        // Just skip.
        return false;
    }
}
exports.shouldGenResolverTypes = shouldGenResolverTypes;
function getSchemaPointers(schema, _acc = []) {
    if (typeof schema === 'string') {
        _acc.push(schema);
    }
    else if (Array.isArray(schema)) {
        for (const s of schema)
            getSchemaPointers(s, _acc);
    }
    else if (typeof schema === 'object') {
        for (const s of Object.keys(schema))
            getSchemaPointers(s, _acc);
    }
    return _acc;
}
async function createSchemaHash(execContext) {
    const { config, configHash, cwd } = execContext;
    const schemaPointers = getSchemaPointers(config.schema);
    const filePointers = schemaPointers.filter((p) => !paths_1.isURL(p));
    // XXX: Should stream?
    const files = await globby_1.default(filePointers, { cwd, absolute: true });
    const contents = await p_map_1.default(files.map(slash_1.default).sort(), (file) => file_1.readFile(file), { concurrency: 10 });
    return hash_1.createHashFromBuffers([configHash, ...contents]);
}
exports.createSchemaHash = createSchemaHash;
async function processResolverTypesIfNeeded(execContext, codegenContext) {
    const { cwd, config, configHash } = execContext;
    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash = configHash;
    if (shouldGenResolverTypes(config)) {
        schemaHash = await createSchemaHash(execContext);
        const createdPaths = paths_1.createPaths(execContext, config.schemaEntrypoint);
        const shouldUpdate = schemaHash !== (await file_1.readHash(createdPaths.tsxFullPath)) ||
            schemaHash !== (await file_1.readHash(createdPaths.dtsFullPath));
        const context = {
            ...createdPaths,
            gqlHash: schemaHash,
            dtsContentDecorator: (s) => {
                return `${s}
          
// This is an extra code in addition to what graphql-codegen makes.
// Users are likely to use 'graphql-tag/loader' with 'graphql-tag/schema/loader'
// in webpack. This code enables the result to be typed.
import { DocumentNode } from 'graphql'
export default typeof DocumentNode
`;
            },
            skip: !shouldUpdate,
        };
        codegenContext.push(context);
        if (shouldUpdate) {
            // We don't delete tsxFullPath and dtsFullPath here because:
            // 1. We'll overwrite them so deleting is not necessary
            // 2. Windows throws EPERM error for the deleting and creating file process.
            print_1.updateLog(`Local schema files are detected. Generating resolver types...`);
            await graphql_codegen_1.processGraphQLCodegen(execContext, [context], {
                silent: true,
                ...config,
                cwd,
                generates: {
                    [context.tsxFullPath]: {
                        plugins: ['typescript', 'typescript-resolvers'],
                    },
                },
            });
        }
    }
    return { schemaHash };
}
exports.processResolverTypesIfNeeded = processResolverTypesIfNeeded;
