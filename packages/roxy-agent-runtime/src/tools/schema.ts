import { ZodArray, ZodBoolean, ZodEnum, ZodNumber, ZodObject, ZodOptional, ZodString, ZodUnion } from "zod";
import type { ZodTypeAny } from "zod";
import type { JsonSchema } from "../core/interfaces.ts";

/**
 * Convert a zod schema (the subset we use) into an Anthropic-compatible
 * {@link JsonSchema}. Any zod type outside the supported set causes a throw —
 * pass an explicit hand-written {@link JsonSchema} for unsupported shapes.
 *
 * Supported: string/number/boolean/array/object/enum/optional/union/describe.
 */
export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const base = convertInner(schema);
  const description = schema.description;
  return description ? { ...base, description } : base;
}

function convertInner(schema: ZodTypeAny): JsonSchema {
  if (schema instanceof ZodString) return { type: "string" };
  if (schema instanceof ZodNumber) return { type: "number" };
  if (schema instanceof ZodBoolean) return { type: "boolean" };

  if (schema instanceof ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema._def.element as ZodTypeAny) };
  }

  if (schema instanceof ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(field);
      if (!(field instanceof ZodOptional)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof ZodEnum) {
    // Zod v4: _def.entries is a Record<string, string>
    const entries = schema._def.entries as Record<string, string>;
    const values = Object.values(entries);
    return { type: "string", enum: values };
  }

  if (schema instanceof ZodUnion) {
    const options = schema._def.options as ZodTypeAny[];
    return { anyOf: options.map(zodToJsonSchema) };
  }

  if (schema instanceof ZodOptional) {
    return zodToJsonSchema(schema._def.innerType as ZodTypeAny);
  }

  throw new Error(`zodToJsonSchema: unsupported zod type "${schema.constructor.name}"`);
}
