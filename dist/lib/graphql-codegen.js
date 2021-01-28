"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGraphQLCodegen = exports.buildCodegenConfig = void 0;
const cli_1 = require("@graphql-codegen/cli");
const make_dir_1 = __importDefault(require("make-dir"));
const path_1 = __importDefault(require("path"));
const file_1 = require("./file");
const print_1 = require("./print");
const types_1 = require("./types");
function buildCodegenConfig({ cwd, config }, codegenContext) {
    const generates = Object.create(null);
    for (const context of codegenContext) {
        const { tsxFullPath } = context;
        const documents = types_1.isLiteralContext(context)
            ? // XXX: We want to pass shorter `strippedGqlContent`,
                // but `# import` also disappears!
                context.gqlContent
            : context.gqlRelPath;
        generates[tsxFullPath] = {
            ...config.generateOptions,
            // graphql-let -controlled fields:
            documents,
            plugins: config.plugins,
        };
    }
    return {
        silent: true,
        ...config,
        // @ts-ignore
        cwd,
        // @ts-ignore This allows recognizing "#import" in GraphQL documents
        skipGraphQLImport: false,
        // In our config, "documents" should always be empty
        // since "generates" should take care of them.
        documents: undefined,
        generates,
    };
}
exports.buildCodegenConfig = buildCodegenConfig;
async function processGraphQLCodegen(execContext, codegenContext, generateArg) {
    let results;
    try {
        results = await cli_1.generate(generateArg, false);
    }
    catch (error) {
        if (error.name === 'ListrError' && error.errors != null) {
            for (const err of error.errors) {
                err.message = `${err.message}${err.details}`;
                print_1.printError(err);
            }
        }
        else {
            print_1.printError(error);
        }
        throw error;
    }
    if (codegenContext.length !== results.length)
        throw new Error('never');
    // Object option "generates" in codegen obviously doesn't guarantee result's order.
    const tsxPathTable = new Map(codegenContext.map((c) => [c.tsxFullPath, c]));
    for (const result of results) {
        const { filename, content } = result;
        const context = tsxPathTable.get(filename);
        if (!context)
            throw new Error('never');
        await make_dir_1.default(path_1.default.dirname(filename));
        await file_1.writeFile(filename, file_1.withHash(context.gqlHash, content));
    }
    return results;
}
exports.processGraphQLCodegen = processGraphQLCodegen;
