"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDtsForContext = exports.genDts = void 0;
const make_dir_1 = __importDefault(require("make-dir"));
const path_1 = require("path");
const slash_1 = __importDefault(require("slash"));
const typescript_1 = require("typescript");
const file_1 = require("./file");
const essentialCompilerOptions = {
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    noEmit: false,
};
function resolveCompilerOptions(cwd, { TSConfigFile }) {
    const fileName = TSConfigFile || 'tsconfig.json';
    const configPath = typescript_1.findConfigFile(cwd, typescript_1.sys.fileExists, fileName);
    let compilerOptions = essentialCompilerOptions;
    if (configPath != null) {
        const { config, error } = typescript_1.readConfigFile(configPath, (name) => typescript_1.sys.readFile(name));
        if (config != null) {
            const settings = typescript_1.convertCompilerOptionsFromJson({ ...config['compilerOptions'], ...essentialCompilerOptions }, cwd);
            if (settings.errors.length > 0) {
                console.log(settings.errors);
            }
            compilerOptions = settings.options;
        }
        else if (error) {
            console.error(`${error.file && error.file.fileName}: ${error.messageText}`);
        }
    }
    else {
        console.error(`Could not find a valid tsconfig file ('${fileName}').`);
    }
    return compilerOptions;
}
function genDts({ cwd, config }, tsxFullPaths) {
    const compilerOptions = resolveCompilerOptions(cwd, config);
    tsxFullPaths = tsxFullPaths.map((tsxFullPath) => slash_1.default(tsxFullPath));
    const tsxFullPathSet = new Set(tsxFullPaths);
    const compilerHost = typescript_1.createCompilerHost(compilerOptions);
    const dtsContents = [];
    compilerHost.writeFile = (name, dtsContent, writeByteOrderMark, onError, sourceFiles) => {
        // TypeScript can write `d.ts`s of submodules imported from `.tsx`s.
        // We only pick up `.d.ts`s for `.tsx` entry points.
        const [{ fileName }] = sourceFiles;
        if (!tsxFullPathSet.has(fileName))
            return;
        dtsContents.push(dtsContent);
    };
    const program = typescript_1.createProgram(tsxFullPaths, compilerOptions, compilerHost);
    const result = program.emit();
    // Make sure that the compilation is successful
    if (result.emitSkipped) {
        result.diagnostics.forEach((diagnostic) => {
            if (diagnostic.file) {
                const { line, character, } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                // log diagnostic message
                const message = typescript_1.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            }
            else {
                console.error(`${typescript_1.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
            }
        });
        throw new Error('Failed to generate .d.ts.');
    }
    if (tsxFullPaths.length !== dtsContents.length) {
        throw new Error(`Never supposed to be here. Please make an issue on GitHub.`);
    }
    return dtsContents;
}
exports.genDts = genDts;
async function processDtsForContext(execContext, codegenContext) {
    if (codegenContext.every(({ skip }) => skip))
        return;
    const dtsContents = genDts(execContext, codegenContext.map(({ tsxFullPath }) => tsxFullPath));
    await make_dir_1.default(path_1.dirname(codegenContext[0].dtsFullPath));
    for (const [i, dtsContent] of dtsContents.entries()) {
        const ctx = codegenContext[i];
        const { dtsFullPath, gqlHash } = ctx;
        const { dtsContentDecorator } = ctx;
        const content = file_1.withHash(gqlHash, dtsContentDecorator ? dtsContentDecorator(dtsContent) : dtsContent);
        await make_dir_1.default(path_1.dirname(dtsFullPath));
        await file_1.writeFile(dtsFullPath, content);
    }
}
exports.processDtsForContext = processDtsForContext;
