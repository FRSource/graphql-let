"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log_update_1 = __importDefault(require("log-update"));
const documents_1 = require("./lib/documents");
const dts_1 = require("./lib/dts");
const exec_context_1 = __importDefault(require("./lib/exec-context"));
const config_1 = __importDefault(require("./lib/config"));
const memoize_1 = __importDefault(require("./lib/memoize"));
const print_1 = require("./lib/print");
const resolver_types_1 = require("./lib/resolver-types");
const processGraphQLCodegenSchemaLoader = memoize_1.default(async (cwd) => {
    const [config, configHash] = await config_1.default(cwd);
    const execContext = exec_context_1.default(cwd, config, configHash);
    const codegenContext = [];
    const { graphqlRelPaths } = await documents_1.findTargetDocuments(execContext);
    const { schemaHash } = await resolver_types_1.processResolverTypesIfNeeded(execContext, codegenContext);
    // Only if schema was changed, documents should also be handled for quick startup of webpack dev.
    if (codegenContext.some(({ skip }) => !skip)) {
        await documents_1.processDocumentsForContext(execContext, schemaHash, codegenContext, graphqlRelPaths);
        print_1.updateLog('Generating .d.ts...');
        await dts_1.processDtsForContext(execContext, codegenContext);
    }
}, () => 'schemaLoader');
const graphlqCodegenSchemaLoader = function (gqlContent) {
    const callback = this.async();
    const { rootContext: cwd } = this;
    processGraphQLCodegenSchemaLoader(cwd)
        .then(() => {
        callback(undefined, gqlContent);
    })
        .catch((e) => {
        log_update_1.default.stderr(print_1.PRINT_PREFIX + e.message);
        log_update_1.default.stderr.done();
        callback(e);
    });
};
exports.default = graphlqCodegenSchemaLoader;
