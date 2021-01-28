"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiteralCache = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const file_1 = require("../file");
const file_2 = require("../file");
class LiteralCache {
    constructor(execContext) {
        this.projectStore = null;
        this.lastModified = null;
        const { cwd, config } = execContext;
        this.dtsEntrypointFullPath = path_1.join(cwd, config.gqlDtsEntrypoint);
        this.storeFullPath = path_1.join(cwd, path_1.dirname(config.gqlDtsEntrypoint), 'store.json');
    }
    async load() {
        if (fs_1.existsSync(this.storeFullPath)) {
            this.lastModified = file_2.statSync(this.storeFullPath).mtimeMs;
            const content = await file_1.readFile(this.storeFullPath, 'utf-8');
            this.projectStore = JSON.parse(content);
        }
        else {
            this.projectStore = Object.create(null);
        }
    }
    get(sourceRelPath) {
        if (!this.projectStore)
            throw new Error('boom');
        return (this.projectStore[sourceRelPath] ||
            (this.projectStore[sourceRelPath] = Object.create(null)));
    }
    async unload() {
        if (!this.projectStore)
            throw new Error('never');
        if (fs_1.existsSync(this.storeFullPath) &&
            file_2.statSync(this.storeFullPath).mtimeMs !== this.lastModified)
            throw new Error('something wrong.');
        // Update store.json
        await file_1.writeFile(this.storeFullPath, JSON.stringify(this.projectStore, null, 2));
        // Update index.d.ts
        const accumulator = new Map();
        for (const sourceRelPath of Object.keys(this.projectStore)) {
            const partial = this.projectStore[sourceRelPath];
            for (const hash of Object.keys(partial)) {
                const [dtsRelPath, gqlContent] = partial[hash];
                accumulator.set(hash, [dtsRelPath, gqlContent]);
            }
        }
        let dtsEntrypointContent = '';
        for (const [hash, [dtsRelPath, gqlContent]] of accumulator) {
            dtsEntrypointContent += `import T${hash} from './${dtsRelPath}';
export default function gql(gql: \`${gqlContent}\`): T${hash}.__AllExports;
`;
        }
        await file_1.writeFile(this.dtsEntrypointFullPath, dtsEntrypointContent);
        // Invalidate the instance
        this.projectStore = null;
    }
}
exports.LiteralCache = LiteralCache;
