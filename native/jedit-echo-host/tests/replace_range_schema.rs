use std::fmt::Debug;

use jedit_echo_host::identity::hash_bytes;
use jedit_echo_host::records::{
    fact_bytes, fact_id, fact_type_id, BlobFact, BranchFact, BufferFact, ContentAddressedFact,
    DiffFact, HeadFact, LeafFact, NodeIdBytes, RewriteFact, TypedFact, BLOB_CONTENT_HASH_DOMAIN,
    BUFFER_NODE_ID_DOMAIN, EMPTY_ROOT_DIGEST_DOMAIN,
};
use jedit_echo_host::rope::{buffer_node_id, MAX_LEAF_BYTES};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use static_assertions::{assert_impl_all, assert_not_impl_any};

const SCHEMA_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.json"
));
const SCHEMA_SHA256: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.sha256"
));
const CODEC_VECTOR_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/codec-vectors-v1.json"
));
const CODEC_VECTOR_SHA256: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/codec-vectors-v1.sha256"
));

const SCHEMA_COORDINATE: &str = "jedit.text.schema@1";

assert_not_impl_any!(BufferFact: ContentAddressedFact);
assert_impl_all!(BlobFact: ContentAddressedFact);
assert_impl_all!(LeafFact: ContentAddressedFact);
assert_impl_all!(BranchFact: ContentAddressedFact);
assert_impl_all!(HeadFact: ContentAddressedFact);
assert_impl_all!(RewriteFact: ContentAddressedFact);
assert_impl_all!(DiffFact: ContentAddressedFact);

#[derive(Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CodecResource {
    format_version: u32,
    schema_coordinate: String,
    vectors: Vec<CodecVector>,
}

#[derive(Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CodecVector {
    fact: String,
    type_label: String,
    type_id_hex: String,
    identity: IdentityVector,
    value: Value,
    canonical_bytes_hex: String,
}

#[derive(Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "kind",
    deny_unknown_fields
)]
enum IdentityVector {
    #[serde(rename = "keyed")]
    Keyed {
        buffer_key: String,
        node_id_hex: String,
    },
    #[serde(rename = "content-addressed")]
    ContentAddressed {
        domain_hex: String,
        node_id_hex: String,
    },
}

#[test]
fn published_schema_and_codec_vectors_regenerate_byte_for_byte() {
    assert_eq!(SCHEMA_BYTES, pretty_json_bytes(&expected_schema()));
    assert_eq!(
        CODEC_VECTOR_BYTES,
        pretty_json_bytes(&expected_codec_resource())
    );
    assert_eq!(sha256_hex(SCHEMA_BYTES), checked_digest(SCHEMA_SHA256));
    assert_eq!(
        sha256_hex(CODEC_VECTOR_BYTES),
        checked_digest(CODEC_VECTOR_SHA256)
    );
}

#[test]
fn schema_declares_the_native_fact_and_attachment_law() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema JSON should decode");
    assert_eq!(schema, expected_schema());
}

#[test]
fn codec_vectors_match_native_bytes_types_and_identity_domains() {
    let resource: CodecResource =
        serde_json::from_slice(CODEC_VECTOR_BYTES).expect("codec vectors should decode");
    assert_eq!(resource, expected_codec_resource());
    assert_eq!(resource.schema_coordinate, SCHEMA_COORDINATE);
    let [buffer, blob, leaf, branch, head, rewrite, diff] = resource.vectors.as_slice() else {
        panic!("codec resource should contain exactly seven ordered fact vectors");
    };

    check_keyed::<BufferFact>(buffer, "Buffer");
    check_content::<BlobFact>(blob, "Blob");
    check_content::<LeafFact>(leaf, "Leaf");
    check_content::<BranchFact>(branch, "Branch");
    check_content::<HeadFact>(head, "Head");
    check_content::<RewriteFact>(rewrite, "Rewrite");
    check_content::<DiffFact>(diff, "Diff");
}

fn expected_schema() -> Value {
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
            "stringEscaping": "serde-json-v1",
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
                "domainHex": hex::encode(b"type:"),
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

fn expected_codec_resource() -> CodecResource {
    let buffer_key = "schema\n\"猫\\path.txt";
    let buffer_id = buffer_node_id(buffer_key);
    let blob_bytes = "A😀\n".as_bytes().to_vec();
    let blob = BlobFact {
        content_hash: hash_bytes(BLOB_CONTENT_HASH_DOMAIN, &blob_bytes),
        bytes: blob_bytes,
    };
    let blob_id = fact_id(&blob).unwrap();
    let leaf = LeafFact {
        blob_id: blob_id.into(),
        byte_start: 0,
        byte_length: 6,
        utf16_length: 4,
        line_breaks: 1,
    };
    let leaf_id = fact_id(&leaf).unwrap();
    let branch = BranchFact {
        left: leaf_id.into(),
        right: NodeIdBytes([0x22; 32]),
        byte_length: 12,
        utf16_length: 8,
        line_breaks: 2,
        height: 2,
    };
    let head = HeadFact {
        buffer_id: buffer_id.into(),
        basis_head_id: Some(NodeIdBytes([0x33; 32])),
        root_node_id: Some(leaf_id.into()),
        byte_length: 6,
        utf16_length: 4,
        line_count: 2,
        root_digest: *leaf_id.as_bytes(),
        sequence: i32::MAX as u64 + 1,
    };
    let head_id = fact_id(&head).unwrap();
    let buffer = BufferFact {
        buffer_key: buffer_key.to_owned(),
        projection_path: None,
        canonical_head_id: head_id.into(),
        version: i32::MAX as u64 + 1,
    };
    let rewrite = RewriteFact {
        buffer_id: buffer_id.into(),
        basis_head_id: NodeIdBytes([0x33; 32]),
        next_head_id: head_id.into(),
        start_byte: i32::MAX as u64 + 1,
        end_byte: i32::MAX as u64 + 5,
        inserted_byte_length: 6,
    };
    let rewrite_id = fact_id(&rewrite).unwrap();
    let diff = DiffFact {
        rewrite_id: rewrite_id.into(),
        basis_head_id: NodeIdBytes([0x33; 32]),
        next_head_id: head_id.into(),
        start_byte: i32::MAX as u64 + 1,
        end_byte: i32::MAX as u64 + 5,
        inserted_byte_length: 6,
        deleted_byte_length: u64::MAX,
    };

    CodecResource {
        format_version: 1,
        schema_coordinate: SCHEMA_COORDINATE.to_owned(),
        vectors: vec![
            keyed_vector("Buffer", buffer_key, &buffer),
            content_vector("Blob", &blob),
            content_vector("Leaf", &leaf),
            content_vector("Branch", &branch),
            content_vector("Head", &head),
            content_vector("Rewrite", &rewrite),
            content_vector("Diff", &diff),
        ],
    }
}

fn keyed_vector<T: TypedFact>(fact_name: &str, buffer_key: &str, fact: &T) -> CodecVector {
    CodecVector {
        fact: fact_name.to_owned(),
        type_label: T::TYPE_LABEL.to_owned(),
        type_id_hex: hex::encode(fact_type_id::<T>().as_bytes()),
        identity: IdentityVector::Keyed {
            buffer_key: buffer_key.to_owned(),
            node_id_hex: hex::encode(buffer_node_id(buffer_key).as_bytes()),
        },
        value: serde_json::to_value(fact).unwrap(),
        canonical_bytes_hex: hex::encode(fact_bytes(fact).unwrap()),
    }
}

fn content_vector<T: ContentAddressedFact>(fact_name: &str, fact: &T) -> CodecVector {
    CodecVector {
        fact: fact_name.to_owned(),
        type_label: T::TYPE_LABEL.to_owned(),
        type_id_hex: hex::encode(fact_type_id::<T>().as_bytes()),
        identity: IdentityVector::ContentAddressed {
            domain_hex: hex::encode(T::ID_DOMAIN),
            node_id_hex: hex::encode(fact_id(fact).unwrap().as_bytes()),
        },
        value: serde_json::to_value(fact).unwrap(),
        canonical_bytes_hex: hex::encode(fact_bytes(fact).unwrap()),
    }
}

fn check_keyed<T>(vector: &CodecVector, expected_name: &str)
where
    T: TypedFact + DeserializeOwned + Debug,
{
    check_codec::<T>(vector, expected_name);
    let IdentityVector::Keyed {
        buffer_key,
        node_id_hex,
    } = &vector.identity
    else {
        panic!("{expected_name} should have keyed identity");
    };
    assert_eq!(
        hex::encode(buffer_node_id(buffer_key).as_bytes()),
        *node_id_hex
    );
}

fn check_content<T>(vector: &CodecVector, expected_name: &str)
where
    T: ContentAddressedFact + DeserializeOwned + Debug,
{
    let fact = check_codec::<T>(vector, expected_name);
    let IdentityVector::ContentAddressed {
        domain_hex,
        node_id_hex,
    } = &vector.identity
    else {
        panic!("{expected_name} should have content-addressed identity");
    };
    assert_eq!(hex::encode(T::ID_DOMAIN), *domain_hex);
    assert_eq!(
        hex::encode(fact_id(&fact).unwrap().as_bytes()),
        *node_id_hex
    );
}

fn check_codec<T>(vector: &CodecVector, expected_name: &str) -> T
where
    T: TypedFact + DeserializeOwned + Debug,
{
    assert_eq!(vector.fact, expected_name);
    assert_eq!(vector.type_label, T::TYPE_LABEL);
    assert_eq!(
        vector.type_id_hex,
        hex::encode(fact_type_id::<T>().as_bytes())
    );
    let fact: T = serde_json::from_value(vector.value.clone()).unwrap();
    assert_eq!(
        hex::encode(fact_bytes(&fact).unwrap()),
        vector.canonical_bytes_hex
    );
    fact
}

fn pretty_json_bytes<T: Serialize>(value: &T) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(value).unwrap();
    bytes.push(b'\n');
    bytes
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn checked_digest(value: &str) -> &str {
    let digest = value
        .strip_suffix('\n')
        .expect("digest resource should end with one newline");
    assert_eq!(digest.len(), 64);
    assert!(digest
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
    digest
}
