export const JEDIT_PACKAGE_NAME = 'jedit';
export const JEDIT_PACKAGE_VERSION = '0.1.0-release-gate';

export function jeditPackageVersionLine(): string {
  return `${JEDIT_PACKAGE_NAME} ${JEDIT_PACKAGE_VERSION}`;
}
