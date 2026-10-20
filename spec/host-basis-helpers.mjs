import { createHash } from "node:crypto";

// The host basis the open path sends for a file whose raw bytes are exactly
// `text`, and for a path with no file.
export function fileHostBasis(text) {
  const bytes = Buffer.from(text, "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  return { kind: "file", fingerprint: { algorithm: "sha256", digest, byteLength: bytes.byteLength } };
}

export const MISSING_HOST_BASIS = Object.freeze({ kind: "missing" });
