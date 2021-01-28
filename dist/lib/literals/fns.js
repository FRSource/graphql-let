"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendExportAsObject = exports.parserOption = exports.createPaths = void 0;
const generator_1 = __importDefault(require("@babel/generator"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const path_1 = require("path");
function createPaths(srcRelPath, hash, dtsRelDir, cacheFullDir, cwd) {
    const abs = (relPath) => path_1.join(cwd, relPath);
    const dtsGenFullDir = abs(dtsRelDir);
    // srcRelPath: "pages/index.tsx"
    // "pages"
    const relDir = path_1.dirname(srcRelPath);
    // ".tsx"
    const ext = path_1.extname(srcRelPath);
    // "${cwd}/pages/index.tsx"
    const srcFullPath = abs(srcRelPath);
    // "index"
    const base = path_1.basename(srcRelPath, ext);
    // "index-2345.tsx"
    const tsxBasename = `${base}-${hash}${ext}`;
    // "pages/index-2345.tsx"
    const tsxRelPath = path_1.join(relDir, tsxBasename);
    // "/Users/.../node_modules/graphql-let/__generated__/pages/index-2345.d.ts"
    const tsxFullPath = path_1.join(cacheFullDir, tsxRelPath);
    // "index-2345.d.ts"
    const dtsBasename = `${base}-${hash}.d.ts`;
    // "pages/index-2345.d.ts"
    const dtsRelPath = path_1.join(relDir, dtsBasename);
    // "/Users/.../node_modules/@types/graphql-let/pages/index-2345.d.ts"
    const dtsFullPath = path_1.join(dtsGenFullDir, dtsRelPath);
    return {
        srcRelPath,
        srcFullPath,
        tsxRelPath,
        tsxFullPath,
        dtsRelPath,
        dtsFullPath,
    };
}
exports.createPaths = createPaths;
exports.parserOption = {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'classProperties'],
};
function appendExportAsObject(dtsContent) {
    // TODO: Build ast?
    let allExportsCode = `export declare type __AllExports = { `;
    const visitors = {
        TSDeclareFunction({ node: { id: { name }, }, }) {
            allExportsCode += `${name}: typeof ${name},`;
        },
    };
    visitors.VariableDeclarator = visitors.TSTypeAliasDeclaration = function pushProps({ node: { id: { name }, }, }) {
        allExportsCode += `${name}: ${name},`;
    };
    const dtsAST = parser_1.parse(dtsContent, exports.parserOption);
    traverse_1.default(dtsAST, {
        ExportNamedDeclaration(path) {
            path.traverse(visitors);
        },
        Program: {
            exit(path) {
                allExportsCode += '};';
                // TODO: refactor
                traverse_1.default(parser_1.parse(allExportsCode, exports.parserOption), {
                    ExportNamedDeclaration({ node }) {
                        const body = path.get('body');
                        body[body.length - 1].insertAfter(node);
                    },
                });
            },
        },
    });
    const { code } = generator_1.default(dtsAST);
    return code;
}
exports.appendExportAsObject = appendExportAsObject;
