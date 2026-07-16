const INVALID_JSON_PAYLOAD_MESSAGE = 'invalid json payload';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { readonly [key: string]: JsonValueCandidate };
type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
type JsonValueCandidate = JsonPrimitive | JsonObject | readonly JsonValueCandidate[];

export class InvalidJsonPayloadError extends Error {
  public constructor() {
    super(INVALID_JSON_PAYLOAD_MESSAGE);
    this.name = 'InvalidJsonPayloadError';
    Object.freeze(this);
  }
}

export function encodeJsonObject(value: object): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(value));
}

export function parseJsonBytes(bytes: Uint8Array): JsonValue {
  const value: JsonValueCandidate = JSON.parse(TEXT_DECODER.decode(bytes));
  if (!isJsonValue(value)) {
    throw new InvalidJsonPayloadError();
  }
  return value;
}

function isJsonValue(value: JsonValueCandidate): value is JsonValue {
  if (value === null || isJsonPrimitive(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonRecord(value) && objectValuesAreJson(value);
}

function isJsonPrimitive(value: JsonValueCandidate): value is JsonPrimitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isJsonRecord(value: JsonValueCandidate): value is JsonObject {
  return !Array.isArray(value) && value !== null && typeof value === 'object';
}

function objectValuesAreJson(value: JsonObject): boolean {
  for (const member of Object.values(value)) {
    if (!isJsonValue(member)) {
      return false;
    }
  }
  return true;
}
