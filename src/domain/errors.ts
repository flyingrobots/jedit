/**
 * Base class for all jedit domain errors.
 */
export abstract class JeditDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when the Graft package is not found or cannot be loaded.
 */
export class GraftPackageNotFoundError extends JeditDomainError {}

/**
 * Thrown when a Graft tool execution fails.
 */
export class GraftToolExecutionError extends JeditDomainError {}

/**
 * Thrown when a Graft tool result lacks expected text content.
 */
export class GraftNoTextContentError extends JeditDomainError {}

/**
 * Thrown when a Graft payload does not match the expected structural shape.
 */
export class GraftInvalidPayloadError extends JeditDomainError {}

/**
 * Thrown when a keybinding is duplicated.
 */
export class DuplicateKeyBindingError extends JeditDomainError {}

/**
 * Thrown when a required runtime capability (like sleep) is missing.
 */
export class MissingCapabilityError extends JeditDomainError {}

/**
 * Thrown when a theme variable name is reused within the same theme.
 */
export class DuplicateThemeVariableError extends JeditDomainError {}

/**
 * Thrown when parsing an OBJ file and a face is not a triangle.
 */
export class ObjFaceNotTriangleError extends JeditDomainError {}

/**
 * Thrown when an OBJ face index is malformed.
 */
export class ObjInvalidFaceIndexError extends JeditDomainError {}

/**
 * Thrown when an OBJ face index refers to a vertex that does not exist.
 */
export class ObjFaceIndexOutOfRangeError extends JeditDomainError {}

/**
 * Thrown when an OBJ vertex coordinate is malformed.
 */
export class ObjInvalidVertexCoordinateError extends JeditDomainError {}

/**
 * Thrown when a mesh is expected to have geometry but is empty.
 */
export class EmptyMeshError extends JeditDomainError {}

/**
 * Thrown when a mesh height is invalid (e.g. non-positive).
 */
export class InvalidMeshHeightError extends JeditDomainError {}

/**
 * Thrown when a mesh triangle index is out of bounds.
 */
export class MeshTriangleIndexOutOfRangeError extends JeditDomainError {}

/**
 * Thrown when a mesh vertex index is out of bounds.
 */
export class MeshVertexIndexOutOfRangeError extends JeditDomainError {}

/**
 * Thrown when the title mesh fails to load (e.g. missing asset).
 */
export class TitleMeshLoadError extends JeditDomainError {}

/**
 * Thrown when scene JSON does not match the runtime scene contract.
 */
export class SceneDecodeError extends JeditDomainError {}

/**
 * Thrown when decoded scene data references unavailable runtime assets.
 */
export class SceneLoadError extends JeditDomainError {}
