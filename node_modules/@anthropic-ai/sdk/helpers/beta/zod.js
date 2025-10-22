"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.betaZodTool = betaZodTool;
const tslib_1 = require("../../internal/tslib.js");
const z = tslib_1.__importStar(require("zod/v4"));
/**
 * Creates a tool using the provided Zod schema that can be passed
 * into the `.toolRunner()` method. The Zod schema will automatically be
 * converted into JSON Schema when passed to the API. The provided function's
 * input arguments will also be validated against the provided schema.
 */
function betaZodTool(options) {
    const jsonSchema = z.toJSONSchema(options.inputSchema, { reused: 'ref' });
    if (jsonSchema.type !== 'object') {
        throw new Error(`Zod schema for tool "${options.name}" must be an object, but got ${jsonSchema.type}`);
    }
    // TypeScript doesn't narrow the type after the runtime check, so we need to assert it
    const objectSchema = jsonSchema;
    return {
        type: 'custom',
        name: options.name,
        input_schema: objectSchema,
        description: options.description,
        run: options.run,
        parse: (args) => options.inputSchema.parse(args),
    };
}
//# sourceMappingURL=zod.js.map