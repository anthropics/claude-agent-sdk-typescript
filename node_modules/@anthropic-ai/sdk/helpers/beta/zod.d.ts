import type { infer as zodInfer, ZodType } from 'zod/v4';
import { Promisable, BetaRunnableTool } from "../../lib/tools/BetaRunnableTool.js";
import { BetaToolResultContentBlockParam } from "../../resources/beta.js";
/**
 * Creates a tool using the provided Zod schema that can be passed
 * into the `.toolRunner()` method. The Zod schema will automatically be
 * converted into JSON Schema when passed to the API. The provided function's
 * input arguments will also be validated against the provided schema.
 */
export declare function betaZodTool<InputSchema extends ZodType>(options: {
    name: string;
    inputSchema: InputSchema;
    description: string;
    run: (args: zodInfer<InputSchema>) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
}): BetaRunnableTool<zodInfer<InputSchema>>;
//# sourceMappingURL=zod.d.ts.map