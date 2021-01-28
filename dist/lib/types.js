"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLiteralContext = void 0;
function isLiteralContext(context) {
    return Boolean(context.strippedGqlContent);
}
exports.isLiteralContext = isLiteralContext;
