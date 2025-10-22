import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { Promisable, BetaRunnableTool } from "../../lib/tools/BetaRunnableTool.mjs";
import { BetaToolResultContentBlockParam } from "../../resources/beta.mjs";
type NoInfer<T> = T extends infer R ? R : never;
/**
 * Creates a Tool with a provided JSON schema that can be passed
 * to the `.toolRunner()` method. The schema is used to automatically validate
 * the input arguments for the tool.
 */
export declare function betaTool<const Schema extends Exclude<JSONSchema, boolean> & {
    type: 'object';
}>(options: {
    name: string;
    inputSchema: Schema;
    description: string;
    run: (args: NoInfer<FromSchema<Schema>>) => Promisable<string | Array<BetaToolResultContentBlockParam>>;
}): BetaRunnableTool<NoInfer<FromSchema<Schema>>>;
export {};
//# sourceMappingURL=json-schema.d.mts.map