"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocumentsForContext = exports.processGraphQLCodegenForLiterals = exports.processGraphQLCodegenForFiles = exports.findTargetDocuments = void 0;
const cli_1 = require("@graphql-codegen/cli");
const globby_1 = __importDefault(require("globby"));
const path_1 = require("path");
const import_1 = require("@graphql-tools/import");
const file_1 = require("./file");
const graphql_codegen_1 = require("./graphql-codegen");
const hash_1 = require("./hash");
const paths_1 = require("./paths");
async function findTargetDocuments({ cwd, config, }) {
    const documentPaths = await globby_1.default(config.documents, {
        cwd,
        gitignore: config.respectGitIgnore,
    });
    if (documentPaths.length === 0) {
        throw new Error(`No GraphQL documents are found from the path ${JSON.stringify(config.documents)}. Check "documents" in .graphql-let.yml.`);
    }
    const graphqlRelPaths = [];
    const tsSourceRelPaths = [];
    for (const p of documentPaths) {
        paths_1.isTypeScriptPath(p) ? tsSourceRelPaths.push(p) : graphqlRelPaths.push(p);
    }
    return { graphqlRelPaths, tsSourceRelPaths };
}
exports.findTargetDocuments = findTargetDocuments;
// GraphQLFileLoader only allows "# import" when passing file paths.
// But we want it even in gql(`query {}`), don't we?
class CodegenConfigForLiteralDocuments extends cli_1.CodegenContext {
    constructor(execContext, codegenContext, sourceRelPath) {
        super({
            config: graphql_codegen_1.buildCodegenConfig(execContext, codegenContext),
        });
        const { cwd } = execContext;
        this.cwd = cwd;
        this.sourceRelPath = sourceRelPath;
    }
    async loadDocuments(pointers) {
        const sourceFullPath = path_1.join(this.cwd, this.sourceRelPath);
        return pointers.map((pointer) => {
            // This allows to start from content of GraphQL document, not file path
            const predefinedImports = { [sourceFullPath]: pointer };
            const document = import_1.processImport(sourceFullPath, this.cwd, predefinedImports);
            return { document };
        });
    }
}
function processGraphQLCodegenForFiles(execContext, codegenContext) {
    return graphql_codegen_1.processGraphQLCodegen(execContext, codegenContext, graphql_codegen_1.buildCodegenConfig(execContext, codegenContext));
}
exports.processGraphQLCodegenForFiles = processGraphQLCodegenForFiles;
function processGraphQLCodegenForLiterals(execContext, codegenContext, sourceRelPath) {
    return graphql_codegen_1.processGraphQLCodegen(execContext, codegenContext, new CodegenConfigForLiteralDocuments(execContext, codegenContext, sourceRelPath));
}
exports.processGraphQLCodegenForLiterals = processGraphQLCodegenForLiterals;
async function processDocumentsForContext(execContext, schemaHash, codegenContext, gqlRelPaths, gqlContents) {
    if (!gqlRelPaths.length)
        return [];
    const { cwd } = execContext;
    const documentCodegenContext = [];
    for (const [i, gqlRelPath] of gqlRelPaths.entries()) {
        // Loader passes gqlContent directly
        const gqlContent = gqlContents
            ? gqlContents[i]
            : await file_1.readFile(path_1.join(cwd, gqlRelPath), 'utf-8');
        if (!gqlContent)
            throw new Error('never');
        const createdPaths = paths_1.createPaths(execContext, gqlRelPath);
        const { tsxFullPath, dtsFullPath } = createdPaths;
        // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
        // basically depends on schema, which change should effect to document results.
        const gqlHash = hash_1.createHash(schemaHash + gqlContent);
        const shouldUpdate = gqlHash !== (await file_1.readHash(tsxFullPath)) ||
            gqlHash !== (await file_1.readHash(dtsFullPath));
        const context = {
            ...createdPaths,
            gqlHash,
            dtsContentDecorator: (s) => s,
            skip: !shouldUpdate,
        };
        codegenContext.push(context);
        documentCodegenContext.push(context);
    }
    if (documentCodegenContext.every(({ skip }) => skip))
        return [];
    return await processGraphQLCodegenForFiles(execContext, documentCodegenContext);
}
exports.processDocumentsForContext = processDocumentsForContext;
