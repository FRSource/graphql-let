"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readHash = exports.withHash = exports.removeByPatterns = exports.statSync = exports.readFileSync = exports.writeFile = exports.readFile = exports.rimraf = void 0;
const fs_1 = require("fs");
const fs_2 = require("fs");
const globby_1 = __importDefault(require("globby"));
const rimraf_1 = __importDefault(require("rimraf"));
const util_1 = require("util");
exports.rimraf = util_1.promisify(rimraf_1.default);
exports.readFile = fs_1.promises.readFile, exports.writeFile = fs_1.promises.writeFile;
var fs_3 = require("fs");
Object.defineProperty(exports, "readFileSync", { enumerable: true, get: function () { return fs_3.readFileSync; } });
Object.defineProperty(exports, "statSync", { enumerable: true, get: function () { return fs_3.statSync; } });
// Erasing old cache in __generated__ on HMR.
// Otherwise the multiple `declare module "*/x.graphql"` are exposed.
async function removeByPatterns(cwd, ...patterns) {
    const oldFiles = await globby_1.default(patterns, {
        cwd,
        absolute: true,
    });
    await Promise.all(oldFiles.map((f) => exports.rimraf(f)));
}
exports.removeByPatterns = removeByPatterns;
const leadingStringOfGeneratedContent = '/* ';
const hexHashLength = 40;
function withHash(sourceHash, content) {
    return `${leadingStringOfGeneratedContent}${sourceHash}
 * This file is automatically generated by graphql-let. */

${content}`;
}
exports.withHash = withHash;
function readHash(filePath) {
    if (!fs_2.existsSync(filePath)) {
        return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
        const stream = fs_2.createReadStream(filePath, {
            encoding: 'utf-8',
            highWaterMark: leadingStringOfGeneratedContent.length + hexHashLength,
        });
        stream.on('error', (error) => reject(error));
        stream.on('data', (chunk) => {
            const hash = chunk.slice(leadingStringOfGeneratedContent.length);
            if (hash.length !== hexHashLength)
                return resolve(null);
            resolve(hash);
        });
        stream.read();
    });
}
exports.readHash = readHash;