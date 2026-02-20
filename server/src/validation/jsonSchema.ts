import type { Request, Response, NextFunction } from 'express';

type SchemaType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

interface SchemaBase {
  nullable?: boolean;
}

interface ObjectSchema extends SchemaBase {
  type: 'object';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  minProperties?: number;
  maxProperties?: number;
}

interface ArraySchema extends SchemaBase {
  type: 'array';
  items: JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

interface StringSchema extends SchemaBase {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
}

interface NumberSchema extends SchemaBase {
  type: 'number';
  minimum?: number;
  maximum?: number;
  integer?: boolean;
}

interface BooleanSchema extends SchemaBase {
  type: 'boolean';
}

interface NullSchema extends SchemaBase {
  type: 'null';
}

interface AnyOfSchema extends SchemaBase {
  anyOf: JsonSchema[];
}

export type JsonSchema =
  | ObjectSchema
  | ArraySchema
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | AnyOfSchema;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const joinPath = (base: string, field: string): string => {
  if (!base) return field;
  return `${base}.${field}`;
};

const typeOfValue = (value: unknown): SchemaType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'null';
  }
};

const validateAgainstSchema = (value: unknown, schema: JsonSchema, path: string): string[] => {
  if (schema.nullable && value === null) {
    return [];
  }

  if ('anyOf' in schema) {
    const valid = schema.anyOf.some((candidate) => validateAgainstSchema(value, candidate, path).length === 0);
    return valid ? [] : [`${path} does not match any allowed schema`];
  }

  const actualType = typeOfValue(value);
  if (actualType !== schema.type) {
    return [`${path} must be ${schema.type}`];
  }

  if (schema.type === 'null') {
    return [];
  }

  if (schema.type === 'string') {
    const errors: string[] = [];
    const input = value as string;
    if (schema.minLength !== undefined && input.length < schema.minLength) {
      errors.push(`${path} must have length >= ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && input.length > schema.maxLength) {
      errors.push(`${path} must have length <= ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(input)) {
        errors.push(`${path} does not match required pattern`);
      }
    }
    if (schema.enum && !schema.enum.includes(input)) {
      errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
    }
    return errors;
  }

  if (schema.type === 'number') {
    const errors: string[] = [];
    const input = value as number;
    if (schema.integer && !Number.isInteger(input)) {
      errors.push(`${path} must be an integer`);
    }
    if (schema.minimum !== undefined && input < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && input > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
    return errors;
  }

  if (schema.type === 'boolean') {
    return [];
  }

  if (schema.type === 'array') {
    const errors: string[] = [];
    const input = value as unknown[];
    if (schema.minItems !== undefined && input.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.maxItems !== undefined && input.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} item(s)`);
    }
    if (schema.uniqueItems) {
      const seen = new Set<string>();
      for (let i = 0; i < input.length; i += 1) {
        const key = JSON.stringify(input[i]);
        if (seen.has(key)) {
          errors.push(`${path}[${i}] must be unique`);
          break;
        }
        seen.add(key);
      }
    }
    for (let i = 0; i < input.length; i += 1) {
      errors.push(...validateAgainstSchema(input[i], schema.items, `${path}[${i}]`));
    }
    return errors;
  }

  if (schema.type === 'object') {
    const errors: string[] = [];
    const input = value as Record<string, unknown>;
    const keys = Object.keys(input);

    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push(`${path} must include at least ${schema.minProperties} property(ies)`);
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push(`${path} must include at most ${schema.maxProperties} property(ies)`);
    }

    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) {
        errors.push(`${joinPath(path, field)} is required`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${joinPath(path, key)} is not allowed`);
        }
      }
    }

    for (const [field, childSchema] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) {
        continue;
      }
      errors.push(...validateAgainstSchema(input[field], childSchema, joinPath(path, field)));
    }

    return errors;
  }

  return [`${path} has an unsupported schema configuration`];
};

export const validateJsonSchema = (value: unknown, schema: JsonSchema, rootPath = 'body'): string[] => {
  if (rootPath === 'body' && 'type' in schema && schema.type === 'object' && !isRecord(value)) {
    return ['body must be an object'];
  }
  return validateAgainstSchema(value, schema, rootPath);
};

export const validateJsonBody = (schema: JsonSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors = validateJsonSchema(req.body, schema, 'body');
    if (errors.length > 0) {
      res.status(400).json({
        error: 'Invalid request body',
        details: errors.slice(0, 25),
      });
      return;
    }
    next();
  };
};
