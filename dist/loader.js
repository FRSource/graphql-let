"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log_update_1 = __importDefault(require("log-update"));
const path_1 = require("path");
const loader_utils_1 = require("loader-utils");
const schema_utils_1 = require("schema-utils");
const documents_1 = require("./lib/documents");
const dts_1 = require("./lib/dts");
const exec_context_1 = __importDefault(require("./lib/exec-context"));
const config_1 = __importDefault(require("./lib/config"));
const memoize_1 = __importDefault(require("./lib/memoize"));
const resolver_types_1 = require("./lib/resolver-types");
const print_1 = require("./lib/print");
const file_1 = require("./lib/file");
const optionsSchema = {
    type: 'object',
    properties: {
        configFile: {
            type: 'string',
        },
    },
    required: [],
};
function parseOptions(ctx) {
    const options = loader_utils_1.getOptions(ctx);
    schema_utils_1.validate(optionsSchema, options);
    return options;
}
const processGraphQLLetLoader = memoize_1.default(async (gqlFullPath, gqlContent, addDependency, cwd, options) => {
    const [config, configHash] = await config_1.default(cwd, options.configFile);
    const execContext = exec_context_1.default(cwd, config, configHash);
    // To pass config change on subsequent generation,
    // configHash should be primary hash seed.
    let schemaHash = configHash;
    if (resolver_types_1.shouldGenResolverTypes(config)) {
        schemaHash = await resolver_types_1.createSchemaHash(execContext);
        const schemaFullPath = path_1.join(cwd, config.schemaEntrypoint);
        // If using resolver types, all documents should depend on all schema files.
        addDependency(schemaFullPath);
    }
    const gqlRelPath = path_1.relative(cwd, gqlFullPath);
    const codegenContext = [];
    const [result] = await documents_1.processDocumentsForContext(execContext, schemaHash, codegenContext, [gqlRelPath], [String(gqlContent)]);
    // Cache was obsolete
    if (result) {
        const { content } = result;
        print_1.updateLog('Generating .d.ts...');
        await dts_1.processDtsForContext(execContext, codegenContext);
        print_1.updateLog(`${gqlRelPath} was generated.`);
        // Hack to prevent duplicated logs for simultaneous build, in SSR app for an example.
        await new Promise((resolve) => setTimeout(resolve, 0));
        log_update_1.default.done();
        return content;
    }
    else {
        // When cache is fresh, just load it
        if (codegenContext.length !== 1)
            throw new Error('never');
        const [{ tsxFullPath }] = codegenContext;
        return await file_1.readFile(tsxFullPath, 'utf-8');
    }
}, (gqlFullPath) => gqlFullPath);
const graphQLLetLoader = function (gqlContent) {
    const callback = this.async();
    const { resourcePath: gqlFullPath, rootContext: cwd } = this;
    const options = parseOptions(this);
    processGraphQLLetLoader(gqlFullPath, gqlContent, this.addDependency.bind(this), cwd, options)
        .then((tsxContent) => {
        // Pretend .tsx for later loaders.
        // babel-loader at least doesn't respond the .graphql extension.
        this.resourcePath = `${gqlFullPath}.tsx`;
        callback(undefined, tsxContent);
    })
        .catch((e) => {
        log_update_1.default.stderr(print_1.PRINT_PREFIX + e.message);
        log_update_1.default.stderr.done();
        callback(e);
    });
};
exports.default = graphQLLetLoader;
