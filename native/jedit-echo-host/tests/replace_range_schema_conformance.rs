use std::fmt;

#[path = "support/replace_range_corpus_contract.rs"]
mod corpus_contract;

use jedit_echo_host::records::{
    BlobFact, BranchFact, BufferFact, DiffFact, HeadFact, LeafFact, NodeIdBytes, RewriteFact,
};
use serde::de::{IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use corpus_contract::validate_oracle_contract;

const SCHEMA_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.json"
));
const CODEC_VECTOR_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/codec-vectors-v1.json"
));
const ORACLE_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json"
));

#[derive(Deserialize)]
struct CorpusProjection {
    cases: Vec<CaseProjection>,
}

#[derive(Deserialize)]
struct CaseProjection {
    id: String,
    invocation: InvocationProjection,
    #[serde(rename = "invocationBytesHex")]
    invocation_bytes_hex: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct InvocationProjection {
    buffer_id: String,
    basis_head_id: String,
    start_byte: u64,
    end_byte: u64,
    replacement_utf8_hex: String,
}

#[derive(Debug, Eq, PartialEq)]
struct OrderedMemberNames(Vec<String>);

impl<'de> Deserialize<'de> for OrderedMemberNames {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(MemberNameVisitor)
    }
}

struct MemberNameVisitor;

impl<'de> Visitor<'de> for MemberNameVisitor {
    type Value = OrderedMemberNames;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a canonical fact object")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut names = Vec::new();
        while let Some(name) = map.next_key::<String>()? {
            names.push(name);
            map.next_value::<IgnoredAny>()?;
        }
        Ok(OrderedMemberNames(names))
    }
}

#[test]
fn schema_field_order_matches_the_native_writer_for_every_fact() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");
    let vectors: Value =
        serde_json::from_slice(CODEC_VECTOR_BYTES).expect("codec vectors should decode");
    let declarations = schema["facts"]
        .as_array()
        .expect("facts should be an array");
    let vectors = vectors["vectors"]
        .as_array()
        .expect("vectors should be an array");

    for declaration in declarations {
        let fact_name = declaration["name"]
            .as_str()
            .expect("fact should have a name");
        let declared_names = declaration["fields"]
            .as_array()
            .expect("fields should be an array")
            .iter()
            .map(|field| field["name"].as_str().expect("field should have a name"))
            .collect::<Vec<_>>();
        let vector = vectors
            .iter()
            .find(|vector| vector["fact"] == fact_name)
            .expect("every declared fact should have a codec vector");
        let bytes = hex::decode(
            vector["canonicalBytesHex"]
                .as_str()
                .expect("vector should contain canonical bytes"),
        )
        .expect("canonical bytes should be hexadecimal");
        let actual = serde_json::from_slice::<OrderedMemberNames>(&bytes)
            .expect("canonical fact should decode as an object");
        assert_eq!(actual.0, declared_names, "{fact_name} member-order drift");
    }
}

#[test]
fn schema_field_types_match_the_native_fact_types() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");

    let _: for<'a> fn(&'a BufferFact) -> &'a String = |fact| &fact.buffer_key;
    let _: for<'a> fn(&'a BufferFact) -> &'a Option<String> = |fact| &fact.projection_path;
    let _: fn(&BufferFact) -> NodeIdBytes = |fact| fact.canonical_head_id;
    let _: fn(&BufferFact) -> u64 = |fact| fact.version;
    assert_declared_types(
        &schema,
        "Buffer",
        &[
            ("buffer_key", "utf8-string"),
            ("projection_path", "optional-utf8-string"),
            ("canonical_head_id", "node-id-32"),
            ("version", "u64"),
        ],
    );

    let _: fn(&BlobFact) -> [u8; 32] = |fact| fact.content_hash;
    let _: for<'a> fn(&'a BlobFact) -> &'a Vec<u8> = |fact| &fact.bytes;
    assert_declared_types(
        &schema,
        "Blob",
        &[("content_hash", "digest-32"), ("bytes", "bytes")],
    );

    let _: fn(&LeafFact) -> NodeIdBytes = |fact| fact.blob_id;
    let _: fn(&LeafFact) -> u64 = |fact| fact.byte_start;
    let _: fn(&LeafFact) -> u64 = |fact| fact.byte_length;
    let _: fn(&LeafFact) -> u64 = |fact| fact.utf16_length;
    let _: fn(&LeafFact) -> u64 = |fact| fact.line_breaks;
    assert_declared_types(
        &schema,
        "Leaf",
        &[
            ("blob_id", "node-id-32"),
            ("byte_start", "u64"),
            ("byte_length", "u64"),
            ("utf16_length", "u64"),
            ("line_breaks", "u64"),
        ],
    );

    let _: fn(&BranchFact) -> NodeIdBytes = |fact| fact.left;
    let _: fn(&BranchFact) -> NodeIdBytes = |fact| fact.right;
    let _: fn(&BranchFact) -> u64 = |fact| fact.byte_length;
    let _: fn(&BranchFact) -> u64 = |fact| fact.utf16_length;
    let _: fn(&BranchFact) -> u64 = |fact| fact.line_breaks;
    let _: fn(&BranchFact) -> u32 = |fact| fact.height;
    assert_declared_types(
        &schema,
        "Branch",
        &[
            ("left", "node-id-32"),
            ("right", "node-id-32"),
            ("byte_length", "u64"),
            ("utf16_length", "u64"),
            ("line_breaks", "u64"),
            ("height", "u32"),
        ],
    );

    let _: fn(&HeadFact) -> NodeIdBytes = |fact| fact.buffer_id;
    let _: fn(&HeadFact) -> Option<NodeIdBytes> = |fact| fact.basis_head_id;
    let _: fn(&HeadFact) -> Option<NodeIdBytes> = |fact| fact.root_node_id;
    let _: fn(&HeadFact) -> u64 = |fact| fact.byte_length;
    let _: fn(&HeadFact) -> u64 = |fact| fact.utf16_length;
    let _: fn(&HeadFact) -> u64 = |fact| fact.line_count;
    let _: fn(&HeadFact) -> [u8; 32] = |fact| fact.root_digest;
    let _: fn(&HeadFact) -> u64 = |fact| fact.sequence;
    assert_declared_types(
        &schema,
        "Head",
        &[
            ("buffer_id", "node-id-32"),
            ("basis_head_id", "optional-node-id-32"),
            ("root_node_id", "optional-node-id-32"),
            ("byte_length", "u64"),
            ("utf16_length", "u64"),
            ("line_count", "u64"),
            ("root_digest", "digest-32"),
            ("sequence", "u64"),
        ],
    );

    let _: fn(&RewriteFact) -> NodeIdBytes = |fact| fact.buffer_id;
    let _: fn(&RewriteFact) -> NodeIdBytes = |fact| fact.basis_head_id;
    let _: fn(&RewriteFact) -> NodeIdBytes = |fact| fact.next_head_id;
    let _: fn(&RewriteFact) -> u64 = |fact| fact.start_byte;
    let _: fn(&RewriteFact) -> u64 = |fact| fact.end_byte;
    let _: fn(&RewriteFact) -> u64 = |fact| fact.inserted_byte_length;
    assert_declared_types(
        &schema,
        "Rewrite",
        &[
            ("buffer_id", "node-id-32"),
            ("basis_head_id", "node-id-32"),
            ("next_head_id", "node-id-32"),
            ("start_byte", "u64"),
            ("end_byte", "u64"),
            ("inserted_byte_length", "u64"),
        ],
    );

    let _: fn(&DiffFact) -> NodeIdBytes = |fact| fact.rewrite_id;
    let _: fn(&DiffFact) -> NodeIdBytes = |fact| fact.basis_head_id;
    let _: fn(&DiffFact) -> NodeIdBytes = |fact| fact.next_head_id;
    let _: fn(&DiffFact) -> u64 = |fact| fact.start_byte;
    let _: fn(&DiffFact) -> u64 = |fact| fact.end_byte;
    let _: fn(&DiffFact) -> u64 = |fact| fact.inserted_byte_length;
    let _: fn(&DiffFact) -> u64 = |fact| fact.deleted_byte_length;
    assert_declared_types(
        &schema,
        "Diff",
        &[
            ("rewrite_id", "node-id-32"),
            ("basis_head_id", "node-id-32"),
            ("next_head_id", "node-id-32"),
            ("start_byte", "u64"),
            ("end_byte", "u64"),
            ("inserted_byte_length", "u64"),
            ("deleted_byte_length", "u64"),
        ],
    );
}

fn assert_declared_types(schema: &Value, fact_name: &str, expected: &[(&str, &str)]) {
    let declaration = schema["facts"]
        .as_array()
        .expect("facts should be an array")
        .iter()
        .find(|declaration| declaration["name"] == fact_name)
        .expect("declared fact should exist");
    let actual = declaration["fields"]
        .as_array()
        .expect("fields should be an array")
        .iter()
        .map(|field| {
            (
                field["name"].as_str().expect("field should have a name"),
                field["type"].as_str().expect("field should have a type"),
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(actual, expected, "{fact_name} field-type drift");
}

#[test]
fn string_escape_golden_vector_matches_the_native_writer() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");
    let vectors: Value =
        serde_json::from_slice(CODEC_VECTOR_BYTES).expect("codec vectors should decode");
    let golden = &schema["factCodec"]["stringEscaping"]["goldenVector"];
    let source_bytes = hex::decode(
        golden["sourceUtf8Hex"]
            .as_str()
            .expect("golden source should be hexadecimal"),
    )
    .expect("golden source should decode");
    let source = std::str::from_utf8(&source_bytes).expect("golden source should be UTF-8");
    let expected_json = hex::decode(
        golden["jsonStringUtf8Hex"]
            .as_str()
            .expect("golden JSON should be hexadecimal"),
    )
    .expect("golden JSON should decode");
    assert_eq!(serde_json::to_vec(source).unwrap(), expected_json);
    assert_eq!(vectors["vectors"][0]["value"]["buffer_key"], source);
}

#[test]
fn oracle_invocation_bytes_follow_the_published_u64_codec() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");
    let schema_order = schema["oracleInvocation"]["objectMemberOrder"]
        .as_array()
        .expect("invocation member order should be an array")
        .iter()
        .map(|name| {
            name.as_str()
                .expect("member name should be a string")
                .to_owned()
        })
        .collect::<Vec<_>>();
    let corpus: CorpusProjection =
        serde_json::from_slice(ORACLE_BYTES).expect("oracle corpus should decode");
    for case in &corpus.cases {
        let bytes = hex::decode(&case.invocation_bytes_hex)
            .expect("invocation bytes should be hexadecimal");
        let actual_order = serde_json::from_slice::<OrderedMemberNames>(&bytes)
            .expect("invocation bytes should decode as an object");
        assert_eq!(
            actual_order.0, schema_order,
            "{} member-order drift",
            case.id
        );
        assert_eq!(
            hex::encode(serde_json::to_vec(&case.invocation).unwrap()),
            case.invocation_bytes_hex,
            "{} invocation bytes drifted",
            case.id
        );
    }
    let above_i32 = corpus
        .cases
        .iter()
        .find(|case| case.id == "coordinate-above-graphql-int")
        .expect("fixed-width witness should exist");
    assert_eq!(above_i32.invocation.start_byte, i32::MAX as u64 + 1);
    assert_eq!(above_i32.invocation.end_byte, i32::MAX as u64 + 1);
}

#[test]
fn schema_declares_the_exhaustive_oracle_obstruction_domain() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");
    assert_eq!(
        schema["oracleCorpus"]["terminal"]["semanticCodes"],
        serde_json::json!([
            "range-order-invalid",
            "range-out-of-bounds",
            "utf8-boundary-invalid",
            "no-op",
            "basis-not-canonical",
            "arithmetic-overflow",
            "fact-missing",
            "fact-malformed",
            "content-identity-mismatch",
            "malformed-rope"
        ])
    );
}

#[test]
fn schema_qualifies_local_oracle_identifiers_by_the_top_level_warp() {
    let schema: Value = serde_json::from_slice(SCHEMA_BYTES).expect("schema should decode");
    assert_eq!(
        schema["oracleCorpus"]["localIdentifierQualification"],
        "every footprint and patch identifier is qualified by top-level warpId"
    );
}

#[test]
fn committed_oracle_satisfies_the_strict_corpus_shape() {
    let corpus: Value = serde_json::from_slice(ORACLE_BYTES).expect("oracle corpus should decode");
    validate_oracle_contract(&corpus).expect("oracle corpus should satisfy its strict contract");
}

#[test]
fn strict_corpus_shape_rejects_unknown_members_and_codes() {
    let corpus: Value = serde_json::from_slice(ORACLE_BYTES).expect("oracle corpus should decode");

    let mut unknown_member = corpus.clone();
    unknown_member
        .as_object_mut()
        .expect("corpus should be an object")
        .insert("ambientAuthority".to_owned(), Value::Bool(true));
    assert!(validate_oracle_contract(&unknown_member).is_err());

    let mut unknown_code = corpus;
    let terminal = unknown_code["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find_map(|case| {
            let terminal = case.get_mut("terminal")?;
            (terminal["posture"] == "obstructed").then_some(terminal)
        })
        .expect("an obstruction should exist");
    terminal["semanticCode"] = Value::String("invented-obstruction".to_owned());
    assert!(validate_oracle_contract(&unknown_code).is_err());
}
