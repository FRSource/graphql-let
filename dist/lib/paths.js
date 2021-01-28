"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTypeScriptPath = exports.isURL = exports.createPaths = exports.getCacheFullDir = void 0;
const path_1 = require("path");
const getCacheFullDir = (cwd, cacheDir) => {
    return path_1.isAbsolute(cacheDir) ? cacheDir : path_1.join(cwd, cacheDir);
};
exports.getCacheFullDir = getCacheFullDir;
function createPaths({ cwd, cacheFullDir }, gqlRelPath) {
    const tsxRelPath = `${gqlRelPath}.tsx`;
    const tsxFullPath = path_1.join(cacheFullDir, tsxRelPath);
    const dtsRelPath = `${gqlRelPath}.d.ts`;
    const dtsFullPath = path_1.join(cwd, dtsRelPath);
    const gqlFullPath = path_1.join(cwd, gqlRelPath);
    return {
        gqlRelPath,
        tsxRelPath,
        tsxFullPath,
        dtsFullPath,
        dtsRelPath,
        gqlFullPath,
    };
}
exports.createPaths = createPaths;
function isURL(p) {
    try {
        new URL(p);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.isURL = isURL;
function isTypeScriptPath(path) {
    const x = path_1.extname(path);
    return x === '.ts' || x === '.tsx';
}
exports.isTypeScriptPath = isTypeScriptPath;
