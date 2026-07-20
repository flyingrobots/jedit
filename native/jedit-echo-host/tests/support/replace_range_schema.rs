use jedit_echo_host::records::{
    BlobFact, BranchFact, BufferFact, ContentAddressedFact, DiffFact, HeadFact, LeafFact,
    RewriteFact, TypedFact, BLOB_CONTENT_HASH_DOMAIN, BUFFER_NODE_ID_DOMAIN,
    EMPTY_ROOT_DIGEST_DOMAIN,
};
use jedit_echo_host::rope::MAX_LEAF_BYTES;
use serde_json::{json, Value};

#[path = "replace_range_contract.rs"]
mod contract;

use contract::{
    SemanticObstructionCode, APPLICATION_SCHEMA_COORDINATE, HISTORICAL_PLANNER_CHECKPOINT_ROLE,
    INVOCATION_SCHEMA_COORDINATE, OBSTRUCTED_PATCH_POSTURE, ORACLE_COORDINATE,
};

pub const SCHEMA_COORDINATE: &str = APPLICATION_SCHEMA_COORDINATE;
pub const PUBLISHED_TYPE_ID_DOMAIN: &[u8] = b"type:";
pub const STRING_ESCAPE_VECTOR: &str = concat!(
    "\u{0000}\u{0001}\u{0002}\u{0003}\u{0004}\u{0005}\u{0006}\u{0007}",
    "\u{0008}\u{0009}\u{000a}\u{000b}\u{000c}\u{000d}\u{000e}\u{000f}",
    "\u{0010}\u{0011}\u{0012}\u{0013}\u{0014}\u{0015}\u{0016}\u{0017}",
    "\u{0018}\u{0019}\u{001a}\u{001b}\u{001c}\u{001d}\u{001e}\u{001f}",
    "\"\\/猫\u{2028}\u{2029}\u{10ffff}"
);
const STRING_ESCAPE_VECTOR_JSON_HEX: &str = concat!(
    "225c75303030305c75303030315c75303030325c75303030335c7530303034",
    "5c75303030355c75303030365c75303030375c625c745c6e5c7530303062",
    "5c665c725c75303030655c75303030665c75303031305c75303031315c7530",
    "3031325c75303031335c75303031345c75303031355c75303031365c753030",
    "31375c75303031385c75303031395c75303031615c75303031625c75303031",
    "635c75303031645c75303031655c75303031665c225c5c2fe78cabe280a8e2",
    "80a9f48fbfbf22"
);

pub fn expected_schema() -> Value {
    json!({
        "schemaVersion": 1,
        "coordinate": SCHEMA_COORDINATE,
        "factCodec": {
            "profile": "jedit.compact-serde-json.v1",
            "encoding": "utf-8",
            "byteOrderMark": "forbidden",
            "insignificantWhitespace": "forbidden",
            "objectMemberOrder": "declared-field-order",
            "unsignedInteger": "decimal-no-leading-zeroes",
            "optionalIdentifier": "null-or-array-32-u8",
            "identifier": "array-32-u8",
            "byteString": "array-u8",
            "stringEscaping": {
                "quotationMark": "backslash-quotation-mark",
                "reverseSolidus": "backslash-reverse-solidus",
                "shortEscapes": {
                    "u0008": "backslash-b",
                    "u0009": "backslash-t",
                    "u000a": "backslash-n",
                    "u000c": "backslash-f",
                    "u000d": "backslash-r"
                },
                "otherU0000ThroughU001f": "backslash-u00xx-lowercase-hex",
                "solidus": "literal",
                "otherU0020ThroughU10ffff": "literal-utf8-unicode-scalars",
                "surrogateEscapes": "forbidden",
                "goldenVector": {
                    "sourceUtf8Hex": hex::encode(STRING_ESCAPE_VECTOR.as_bytes()),
                    "jsonStringUtf8Hex": STRING_ESCAPE_VECTOR_JSON_HEX
                }
            },
            "forbiddenValues": [
                "map-valued-fields",
                "floats",
                "signed-integers",
                "duplicate-members",
                "unknown-members"
            ]
        },
        "graphEncoding": {
            "node": "typed-node",
            "attachment": {
                "key": "node-alpha",
                "value": "atom",
                "atomType": "node-type",
                "payload": "canonical-fact-bytes"
            },
            "edges": "none"
        },
        "identityLaws": {
            "typeId": {
                "algorithm": "blake3-256",
                "domainHex": hex::encode(PUBLISHED_TYPE_ID_DOMAIN),
                "material": "type-label-utf8"
            },
            "bufferNode": {
                "algorithm": "blake3-256",
                "domainHex": hex::encode(BUFFER_NODE_ID_DOMAIN),
                "material": "buffer-key-utf8"
            },
            "contentFact": {
                "algorithm": "blake3-256",
                "material": "fact-domain || canonical-fact-bytes"
            },
            "blobContent": {
                "algorithm": "blake3-256",
                "domainHex": hex::encode(BLOB_CONTENT_HASH_DOMAIN),
                "material": "blob-bytes"
            },
            "emptyRootDigest": {
                "algorithm": "blake3-256",
                "domainHex": hex::encode(EMPTY_ROOT_DIGEST_DOMAIN),
                "material": "empty-bytes"
            }
        },
        "ropeLaw": {
            "coordinateType": "u64",
            "range": "half-open-utf8-byte",
            "replacement": "utf8-bytes",
            "maxLeafBytes": MAX_LEAF_BYTES,
            "leafChunkBoundary": "largest-utf8-boundary-at-or-before-limit",
            "leafSlices": "may-share-blob-with-nonzero-byte-start",
            "lineCount": "line-breaks-plus-one-including-empty",
            "nonemptyRootDigest": "root-node-id",
            "persistence": "path-copy-no-delete",
            "emittedOperations": ["upsert-node", "set-node-alpha"]
        },
        "oracleInvocation": {
            "coordinate": INVOCATION_SCHEMA_COORDINATE,
            "posture": "finite-corpus-input-not-runtime-abi",
            "encoding": "compact-utf8-json",
            "objectMemberOrder": [
                "bufferId",
                "basisHeadId",
                "startByte",
                "endByte",
                "replacementUtf8Hex"
            ],
            "fields": [
                {"name": "bufferId", "type": "lowercase-hex-node-id-32"},
                {"name": "basisHeadId", "type": "lowercase-hex-node-id-32"},
                {"name": "startByte", "type": "u64-json-decimal"},
                {"name": "endByte", "type": "u64-json-decimal"},
                {"name": "replacementUtf8Hex", "type": "lowercase-hex-utf8-bytes"}
            ],
            "canonicalBytesField": "invocationBytesHex"
        },
        "oracleCorpus": {
            "coordinate": ORACLE_COORDINATE,
            "encoding": "pretty-utf8-json-final-newline",
            "unknownMembers": "forbidden",
            "localIdentifierQualification": "every footprint and patch identifier is qualified by top-level warpId",
            "objectMemberOrder": [
                "schemaVersion",
                "coordinate",
                "applicationSchemaCoordinate",
                "invocationSchemaCoordinate",
                "historicalPlannerCheckpointCommit",
                "sourceSet",
                "evidenceGrade",
                "independenceLimit",
                "warpId",
                "cases"
            ],
            "historicalPlannerCheckpointRole": HISTORICAL_PLANNER_CHECKPOINT_ROLE,
            "sourceSetMemberOrder": [
                "algorithm",
                "domainHex",
                "framing",
                "paths",
                "digestHex"
            ],
            "caseMemberOrder": [
                "id",
                "purpose",
                "basisFacts",
                "invocation",
                "invocationBytesHex",
                "terminal"
            ],
            "basisFactMemberOrder": [
                "nodeId",
                "typeId",
                "attachmentBytesHex"
            ],
            "terminal": {
                "discriminant": "posture",
                "committableMemberOrder": [
                    "posture",
                    "footprint",
                    "patch",
                    "createdNodeIds",
                    "updatedNodeIds",
                    "untouchedBasisNodeIds",
                    "result"
                ],
                "obstructedMemberOrder": [
                    "posture",
                    "semanticCode",
                    "legacyErrorClass",
                    "legacyMessage",
                    "parentGraphUnchanged",
                    "patchPosture"
                ],
                "semanticCodes": SemanticObstructionCode::ALL
                    .iter()
                    .map(|code| code.as_str())
                    .collect::<Vec<_>>(),
                "obstructedPatchPosture": OBSTRUCTED_PATCH_POSTURE
            },
            "footprintMemberOrder": [
                "nodeReads",
                "nodeWrites",
                "attachmentReads",
                "attachmentWrites",
                "edgeReads",
                "edgeWrites"
            ],
            "patchVariants": [
                {
                    "kind": "upsert-node",
                    "memberOrder": ["kind", "nodeId", "typeId"]
                },
                {
                    "kind": "set-node-alpha",
                    "memberOrder": [
                        "kind",
                        "nodeId",
                        "typeId",
                        "attachmentBytesHex"
                    ]
                }
            ],
            "resultMemberOrder": [
                "bufferId",
                "headId",
                "rootNodeId",
                "rootDigest",
                "rewriteId",
                "diffId",
                "byteLength",
                "utf16Length",
                "lineCount",
                "sequence",
                "version",
                "materializedTextUtf8Hex"
            ]
        },
        "facts": [
            fact_declaration::<BufferFact>(
                "Buffer",
                json!({
                    "kind": "keyed",
                    "domainHex": hex::encode(BUFFER_NODE_ID_DOMAIN),
                    "material": "buffer_key utf8"
                }),
                &[
                    ("buffer_key", "utf8-string"),
                    ("projection_path", "optional-utf8-string"),
                    ("canonical_head_id", "node-id-32"),
                    ("version", "u64")
                ]
            ),
            content_fact_declaration::<BlobFact>(
                "Blob",
                &[("content_hash", "digest-32"), ("bytes", "bytes")]
            ),
            content_fact_declaration::<LeafFact>(
                "Leaf",
                &[
                    ("blob_id", "node-id-32"),
                    ("byte_start", "u64"),
                    ("byte_length", "u64"),
                    ("utf16_length", "u64"),
                    ("line_breaks", "u64")
                ]
            ),
            content_fact_declaration::<BranchFact>(
                "Branch",
                &[
                    ("left", "node-id-32"),
                    ("right", "node-id-32"),
                    ("byte_length", "u64"),
                    ("utf16_length", "u64"),
                    ("line_breaks", "u64"),
                    ("height", "u32")
                ]
            ),
            content_fact_declaration::<HeadFact>(
                "Head",
                &[
                    ("buffer_id", "node-id-32"),
                    ("basis_head_id", "optional-node-id-32"),
                    ("root_node_id", "optional-node-id-32"),
                    ("byte_length", "u64"),
                    ("utf16_length", "u64"),
                    ("line_count", "u64"),
                    ("root_digest", "digest-32"),
                    ("sequence", "u64")
                ]
            ),
            content_fact_declaration::<RewriteFact>(
                "Rewrite",
                &[
                    ("buffer_id", "node-id-32"),
                    ("basis_head_id", "node-id-32"),
                    ("next_head_id", "node-id-32"),
                    ("start_byte", "u64"),
                    ("end_byte", "u64"),
                    ("inserted_byte_length", "u64")
                ]
            ),
            content_fact_declaration::<DiffFact>(
                "Diff",
                &[
                    ("rewrite_id", "node-id-32"),
                    ("basis_head_id", "node-id-32"),
                    ("next_head_id", "node-id-32"),
                    ("start_byte", "u64"),
                    ("end_byte", "u64"),
                    ("inserted_byte_length", "u64"),
                    ("deleted_byte_length", "u64")
                ]
            )
        ],
        "excludedPropositions": [
            "jedit.text.RopeStructuralMaintenance",
            "jedit.text.RopeCheckpoint",
            "jedit.text.RopeCheckpointAnchored",
            "receipt-attribution-fields",
            "structural-echo-edges",
            "typed-diff-spans"
        ],
        "migrationPosture": {
            "nativeJsonV1": "authoritative",
            "typescriptGraphRope": "not-an-alternate-encoding",
            "codecOrStructuralChange": "new-schema-coordinate-and-admitted-migration"
        }
    })
}

fn fact_declaration<T: TypedFact>(name: &str, identity: Value, fields: &[(&str, &str)]) -> Value {
    json!({
        "name": name,
        "typeLabel": T::TYPE_LABEL,
        "identity": identity,
        "fields": fields
            .iter()
            .map(|(field, kind)| json!({"name": field, "type": kind}))
            .collect::<Vec<_>>()
    })
}

fn content_fact_declaration<T: ContentAddressedFact>(name: &str, fields: &[(&str, &str)]) -> Value {
    fact_declaration::<T>(
        name,
        json!({
            "kind": "content-addressed",
            "algorithm": "blake3-256",
            "domainHex": hex::encode(T::ID_DOMAIN),
            "material": "domain || canonical-fact-bytes"
        }),
        fields,
    )
}
