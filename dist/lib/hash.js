"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHashFromBuffers = exports.createHash = void 0;
const os_1 = require("os");
const crypto_1 = __importDefault(require("crypto"));
const shouldCareNewline = os_1.EOL !== '\n';
const RegexCRLF = /\r\n/g;
function normalizeNewline(input) {
    const str = Buffer.isBuffer(input) ? input.toString() : input;
    if (shouldCareNewline)
        return str.replace(RegexCRLF, '\n');
    return str;
}
function createHash(s) {
    return crypto_1.default.createHash('sha1').update(normalizeNewline(s)).digest('hex');
}
exports.createHash = createHash;
function createHashFromBuffers(ss) {
    const hash = crypto_1.default.createHash('sha1');
    for (const s of ss)
        hash.update(normalizeNewline(s));
    return hash.digest('hex');
}
exports.createHashFromBuffers = createHashFromBuffers;
