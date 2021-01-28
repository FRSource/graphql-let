"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paths_1 = require("./paths");
function createExecContext(cwd, config, configHash) {
    const cacheFullDir = paths_1.getCacheFullDir(cwd, config.cacheDir);
    return {
        cwd,
        config,
        configHash,
        cacheFullDir,
    };
}
exports.default = createExecContext;
