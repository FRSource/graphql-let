"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modifyLiteralCalls = exports.visitLiteralCalls = exports.getGraphQLLetBabelOption = void 0;
const core_1 = require("@babel/core");
const path_1 = require("path");
const helper_plugin_utils_1 = require("@babel/helper-plugin-utils");
const do_sync_1 = __importDefault(require("do-sync"));
const slash_1 = __importDefault(require("slash"));
const print_1 = require("./lib/print");
const { isIdentifier, isImportDefaultSpecifier, identifier, importDeclaration, importNamespaceSpecifier, valueToNode, } = core_1.types;
const processLiteralsWithDtsGenerateSync = do_sync_1.default(({ hostDirname, ...gqlCompileArgs }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const modulePath = join(hostDirname, '../dist/lib/literals/literals');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { processLiteralsWithDtsGenerate } = require(modulePath);
    return processLiteralsWithDtsGenerate(gqlCompileArgs);
});
function getGraphQLLetBabelOption(babelOptions) {
    for (const { key, options } of babelOptions.plugins || []) {
        if (key.includes('graphql-let/')) {
            return options;
        }
    }
    return {};
}
exports.getGraphQLLetBabelOption = getGraphQLLetBabelOption;
function visitLiteralCalls(programPath, importName, onlyMatchImportSuffix) {
    const pendingDeletion = [];
    const literalCallExpressionPaths = [];
    let hasError = false;
    const tagNames = [];
    function processTargetCalls(path, nodeName) {
        if (tagNames.some((name) => {
            return isIdentifier(path.get(nodeName).node, { name });
        })) {
            try {
                let value = '';
                path.traverse({
                    TemplateLiteral(path) {
                        if (path.node.quasis.length !== 1)
                            print_1.printError(new Error(`TemplateLiteral of the argument must not contain arguments.`));
                        value = path.node.quasis[0].value.raw;
                    },
                    StringLiteral(path) {
                        value = path.node.value;
                    },
                });
                if (!value)
                    print_1.printError(new Error(`Check argument.`));
                literalCallExpressionPaths.push([path, value]);
            }
            catch (error) {
                print_1.printError(error);
                hasError = true;
            }
        }
    }
    programPath.traverse({
        ImportDeclaration(path) {
            const pathValue = path.node.source.value;
            if (onlyMatchImportSuffix
                ? pathValue.endsWith(importName)
                : pathValue === importName) {
                const defaultSpecifier = path.node.specifiers.find((specifier) => {
                    return isImportDefaultSpecifier(specifier);
                });
                if (defaultSpecifier) {
                    tagNames.push(defaultSpecifier.local.name);
                    pendingDeletion.push({
                        defaultSpecifier,
                        path,
                    });
                }
            }
        },
        CallExpression(path) {
            processTargetCalls(path, 'callee');
        },
        TaggedTemplateExpression(path) {
            processTargetCalls(path, 'tag');
        },
    });
    return {
        pendingDeletion,
        literalCallExpressionPaths: literalCallExpressionPaths,
        hasError,
    };
}
exports.visitLiteralCalls = visitLiteralCalls;
function modifyLiteralCalls(programPath, sourceFullPath, visitLiteralCallResults, codegenContext) {
    const { literalCallExpressionPaths, pendingDeletion, hasError, } = visitLiteralCallResults;
    if (literalCallExpressionPaths.length !== codegenContext.length)
        throw new Error('what');
    for (const [i, [callExpressionPath],] of literalCallExpressionPaths.entries()) {
        const { gqlHash, tsxFullPath } = codegenContext[i];
        const tsxRelPathFromSource = './' + slash_1.default(path_1.relative(path_1.dirname(sourceFullPath), tsxFullPath));
        const localVarName = `V${gqlHash}`;
        const importNode = importDeclaration([importNamespaceSpecifier(identifier(localVarName))], valueToNode(tsxRelPathFromSource));
        programPath.unshiftContainer('body', importNode);
        callExpressionPath.replaceWithSourceString(localVarName);
    }
    // Only delete import statement or specifier when there is no error
    if (!hasError) {
        for (const { defaultSpecifier, path: pathForDeletion } of pendingDeletion) {
            if (pathForDeletion.node.specifiers.length === 1) {
                pathForDeletion.remove();
            }
            else {
                pathForDeletion.node.specifiers = pathForDeletion.node.specifiers.filter((specifier) => {
                    return specifier !== defaultSpecifier;
                });
            }
        }
    }
}
exports.modifyLiteralCalls = modifyLiteralCalls;
// With all my respect, I cloned the source from
// https://github.com/gajus/babel-plugin-graphql-tag/blob/master/src/index.js
const configFunction = (api, options) => {
    api.assertVersion(7);
    const { configFilePath, importName = 'graphql-let', onlyMatchImportSuffix = false, } = options;
    return {
        visitor: {
            Program(programPath, state) {
                const { cwd } = state;
                const sourceFullPath = state.file.opts.filename;
                const sourceRelPath = path_1.relative(cwd, sourceFullPath);
                const visitLiteralCallResults = visitLiteralCalls(programPath, importName, onlyMatchImportSuffix);
                const { literalCallExpressionPaths } = visitLiteralCallResults;
                // TODO: Handle error
                if (!literalCallExpressionPaths.length)
                    return;
                const literalCodegenContext = processLiteralsWithDtsGenerateSync({
                    hostDirname: __dirname,
                    cwd,
                    configFilePath,
                    sourceRelPath,
                    gqlContents: literalCallExpressionPaths.map(([, value]) => value),
                }); // Suppress JSONValue error. LiteralCodegenContext has a function property, but it can be ignored.
                modifyLiteralCalls(programPath, sourceFullPath, visitLiteralCallResults, literalCodegenContext);
            },
        },
    };
};
exports.default = helper_plugin_utils_1.declare(configFunction);
