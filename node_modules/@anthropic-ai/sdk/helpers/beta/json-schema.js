"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.betaTool = betaTool;
/**
 * Creates a Tool with a provided JSON schema that can be passed
 * to the `.toolRunner()` method. The schema is used to automatically validate
 * the input arguments for the tool.
 */
function betaTool(options) {
    if (options.inputSchema.type !== 'object') {
        throw new Error(`JSON schema for tool "${options.name}" must be an object, but got ${options.inputSchema.type}`);
    }
    return {
        type: 'custom',
        name: options.name,
        input_schema: options.inputSchema,
        description: options.description,
        run: options.run,
        parse: (content) => content,
    };
}
//# sourceMappingURL=json-schema.js.map