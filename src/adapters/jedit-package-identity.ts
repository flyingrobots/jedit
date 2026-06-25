import { readFileSync } from 'node:fs';

const PACKAGE_MANIFEST_URL = new URL('../../package.json', import.meta.url);
const PACKAGE_MANIFEST_ENCODING = 'utf8';
const PACKAGE_MANIFEST_FIELDS = Object.freeze({
  Name: 'name',
  Version: 'version',
} as const);

interface JeditPackageManifest {
  readonly name?: string;
  readonly version?: string;
}

export class JeditPackageManifestError extends Error {}

export const JEDIT_PACKAGE_NAME = packageManifestField(PACKAGE_MANIFEST_FIELDS.Name);
export const JEDIT_PACKAGE_VERSION = packageManifestField(PACKAGE_MANIFEST_FIELDS.Version);

export function jeditPackageVersionLine(): string {
  return `${JEDIT_PACKAGE_NAME} ${JEDIT_PACKAGE_VERSION}`;
}

function packageManifestField(field: typeof PACKAGE_MANIFEST_FIELDS[keyof typeof PACKAGE_MANIFEST_FIELDS]): string {
  const manifest = packageManifest();
  const value = manifest[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new JeditPackageManifestError(`package.json ${field} must be a non-empty string`);
  }
  return value;
}

function packageManifest(): JeditPackageManifest {
  const manifest: JeditPackageManifest = JSON.parse(readFileSync(PACKAGE_MANIFEST_URL, PACKAGE_MANIFEST_ENCODING));
  return manifest;
}
