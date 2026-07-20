#[path = "support/replace_range_contract.rs"]
mod contract;
#[path = "support/replace_range_corpus_contract.rs"]
mod corpus_contract;
#[path = "support/replace_range_corpus_lexemes.rs"]
mod lexemes;
#[path = "support/replace_range_source_set.rs"]
mod source_set;

use serde_json::Value;

use corpus_contract::validate_oracle_contract;

const ORACLE_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../contracts/jedit/lawpacks/replace-range-v1/replace-range-v1.oracle.json"
));
const CORPUS_CONTRACT_SOURCE: &str = include_str!("support/replace_range_corpus_contract.rs");

fn corpus() -> Value {
    serde_json::from_slice(ORACLE_BYTES).expect("oracle corpus should decode")
}

fn bytes(value: &Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(value).expect("mutated corpus should encode");
    bytes.push(b'\n');
    bytes
}

fn assert_invalid(label: &str, mutate: impl FnOnce(&mut Value)) {
    let mut corpus = corpus();
    mutate(&mut corpus);
    let error = validate_oracle_contract(&bytes(&corpus))
        .expect_err("mutated corpus should violate its contract");
    assert!(!error.is_empty(), "{label} returned an empty error");
}

fn assert_pointer_invalid(pointer: &str, value: Value) {
    assert_invalid(pointer, |corpus| {
        *corpus
            .pointer_mut(pointer)
            .unwrap_or_else(|| panic!("{pointer} should exist")) = value;
    });
}

fn committable(corpus: &mut Value) -> &mut Value {
    corpus["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| case["terminal"]["posture"] == "committable")
        .expect("a committable case should exist")
}

fn obstruction(corpus: &mut Value) -> &mut Value {
    corpus["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| case["terminal"]["posture"] == "obstructed")
        .expect("an obstruction should exist")
}

#[test]
fn committed_oracle_satisfies_the_strict_corpus_contract() {
    validate_oracle_contract(ORACLE_BYTES).expect("oracle corpus should satisfy its contract");
}

#[test]
fn strict_corpus_rejects_noncanonical_member_order_and_framing() {
    let canonical = std::str::from_utf8(ORACLE_BYTES).expect("oracle should be UTF-8");
    let ordered = concat!(
        "  \"schemaVersion\": 1,\n",
        "  \"coordinate\": \"jedit.text.ReplaceRange.oracle@1\","
    );
    let reordered = concat!(
        "  \"coordinate\": \"jedit.text.ReplaceRange.oracle@1\",\n",
        "  \"schemaVersion\": 1,"
    );
    assert_eq!(canonical.matches(ordered).count(), 1);
    let reordered = canonical.replacen(ordered, reordered, 1);
    serde_json::from_str::<Value>(&reordered).expect("reordered corpus remains valid JSON");
    assert!(validate_oracle_contract(reordered.as_bytes()).is_err());

    let without_final_newline = ORACLE_BYTES
        .strip_suffix(b"\n")
        .expect("canonical corpus should end in one newline");
    assert!(validate_oracle_contract(without_final_newline).is_err());
}

#[test]
fn corpus_validator_does_not_duplicate_the_obstruction_domain() {
    assert!(!CORPUS_CONTRACT_SOURCE.contains("const CODES"));
}

#[test]
fn strict_corpus_rejects_invalid_typed_and_invariant_values() {
    let mut wrong_version = corpus();
    wrong_version["schemaVersion"] = Value::from(2);
    assert!(validate_oracle_contract(&bytes(&wrong_version)).is_err());

    let mut wrong_algorithm = corpus();
    wrong_algorithm["sourceSet"]["algorithm"] = Value::String("blake3".to_owned());
    assert!(validate_oracle_contract(&bytes(&wrong_algorithm)).is_err());

    let mut unsafe_obstruction = corpus();
    let obstruction = unsafe_obstruction["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| case["terminal"]["posture"] == "obstructed")
        .expect("an obstruction should exist");
    obstruction["terminal"]["parentGraphUnchanged"] = Value::Bool(false);
    assert!(validate_oracle_contract(&bytes(&unsafe_obstruction)).is_err());

    let mut malformed_result = corpus();
    let committable = malformed_result["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| case["terminal"]["posture"] == "committable")
        .expect("a committable case should exist");
    committable["terminal"]["result"]["headId"] = Value::String("aa".to_owned());
    assert!(validate_oracle_contract(&bytes(&malformed_result)).is_err());

    let mut malformed_footprint = corpus();
    let committable = malformed_footprint["cases"]
        .as_array_mut()
        .expect("cases should be an array")
        .iter_mut()
        .find(|case| case["terminal"]["posture"] == "committable")
        .expect("a committable case should exist");
    committable["terminal"]["footprint"]["nodeReads"] = Value::String("not-an-array".to_owned());
    assert!(validate_oracle_contract(&bytes(&malformed_footprint)).is_err());

    let mut unbound_invocation = corpus();
    unbound_invocation["cases"][0]["invocationBytesHex"] = Value::String("7b7d".to_owned());
    assert!(validate_oracle_contract(&bytes(&unbound_invocation)).is_err());
}

#[test]
fn strict_corpus_binds_envelope_and_source_identity() {
    for (pointer, value) in [
        ("/schemaVersion", Value::from(2)),
        ("/coordinate", Value::String("other.operation@1".to_owned())),
        (
            "/applicationSchemaCoordinate",
            Value::String("other.schema@1".to_owned()),
        ),
        (
            "/invocationSchemaCoordinate",
            Value::String("other.invocation@1".to_owned()),
        ),
        ("/semanticBaselineCommit", Value::String("00".repeat(20))),
        (
            "/evidenceGrade",
            Value::String("independent-verification".to_owned()),
        ),
        ("/independenceLimit", Value::String("none".to_owned())),
        ("/warpId", Value::String("AA".repeat(32))),
        ("/sourceSet/algorithm", Value::String("blake3".to_owned())),
        ("/sourceSet/domainHex", Value::String("00".to_owned())),
        (
            "/sourceSet/framing",
            Value::String("unframed-concatenation".to_owned()),
        ),
        ("/sourceSet/digestHex", Value::String("00".repeat(32))),
    ] {
        assert_pointer_invalid(pointer, value);
    }

    assert_invalid("foreign source-set path", |corpus| {
        corpus["sourceSet"]["paths"][0] = Value::String("foreign/source.rs".to_owned());
    });
    assert_invalid("reordered source-set paths", |corpus| {
        corpus["sourceSet"]["paths"]
            .as_array_mut()
            .expect("source-set paths should be an array")
            .swap(0, 1);
    });
}

#[test]
fn strict_corpus_validates_leaf_lexemes_and_numeric_domains() {
    for (pointer, value) in [
        (
            "/cases/0/basisFacts/0/nodeId",
            Value::String("AA".repeat(32)),
        ),
        (
            "/cases/0/basisFacts/0/typeId",
            Value::String("aa".repeat(31)),
        ),
        (
            "/cases/0/basisFacts/0/attachmentBytesHex",
            Value::String("0".to_owned()),
        ),
        (
            "/cases/0/terminal/footprint/nodeReads/0",
            Value::String("gg".repeat(32)),
        ),
        (
            "/cases/0/terminal/patch/0/nodeId",
            Value::String("aa".repeat(31)),
        ),
        (
            "/cases/0/terminal/patch/0/typeId",
            Value::String("AA".repeat(32)),
        ),
        (
            "/cases/0/terminal/createdNodeIds/0",
            Value::String("0".to_owned()),
        ),
        (
            "/cases/0/terminal/result/headId",
            Value::String("aa".repeat(31)),
        ),
        (
            "/cases/0/terminal/result/rootDigest",
            Value::String("zz".repeat(32)),
        ),
        (
            "/cases/0/terminal/result/byteLength",
            Value::String("4".to_owned()),
        ),
        (
            "/cases/0/terminal/result/materializedTextUtf8Hex",
            Value::String("ff".to_owned()),
        ),
    ] {
        assert_pointer_invalid(pointer, value);
    }

    assert_invalid("set-node-alpha attachment", |corpus| {
        let operation = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array")
            .iter_mut()
            .find(|operation| operation["kind"] == "set-node-alpha")
            .expect("set-node-alpha should exist");
        operation["attachmentBytesHex"] = Value::String("xyz".to_owned());
    });
}

#[test]
fn strict_corpus_enforces_terminal_and_partition_invariants() {
    assert_invalid("false unchanged-parent evidence", |corpus| {
        obstruction(corpus)["terminal"]["parentGraphUnchanged"] = Value::Bool(false);
    });
    assert_invalid("wrong obstruction patch posture", |corpus| {
        obstruction(corpus)["terminal"]["patchPosture"] = Value::String("mutation-plan".to_owned());
    });
    assert_invalid("duplicate case identity", |corpus| {
        let cases = corpus["cases"]
            .as_array_mut()
            .expect("cases should be an array");
        cases[1]["id"] = cases[0]["id"].clone();
    });
    assert_invalid("empty case purpose", |corpus| {
        corpus["cases"][0]["purpose"] = Value::String(String::new());
    });
    assert_invalid("duplicate created node", |corpus| {
        let created = committable(corpus)["terminal"]["createdNodeIds"]
            .as_array_mut()
            .expect("created nodes should be an array");
        created.push(created[0].clone());
    });
    assert_invalid("patch node and atom type disagreement", |corpus| {
        let operation = committable(corpus)["terminal"]["patch"]
            .as_array_mut()
            .expect("patch should be an array")
            .iter_mut()
            .find(|operation| operation["kind"] == "set-node-alpha")
            .expect("set-node-alpha should exist");
        operation["typeId"] = Value::String("00".repeat(32));
    });
    assert_invalid("result metric mismatch", |corpus| {
        committable(corpus)["terminal"]["result"]["byteLength"] = Value::from(999);
    });
}

#[test]
fn strict_corpus_preserves_fixed_width_and_empty_root_witnesses() {
    validate_oracle_contract(ORACLE_BYTES).expect("committed edge cases should remain lawful");
    let corpus = corpus();
    let above_i32 = corpus["cases"]
        .as_array()
        .expect("cases should be an array")
        .iter()
        .find(|case| case["id"] == "coordinate-above-graphql-int")
        .expect("fixed-width case should exist");
    assert_eq!(
        above_i32["invocation"]["startByte"],
        i64::from(i32::MAX) + 1
    );
    let deletion = corpus["cases"]
        .as_array()
        .expect("cases should be an array")
        .iter()
        .find(|case| case["id"] == "whole-buffer-delete")
        .expect("whole-buffer deletion should exist");
    assert!(deletion["terminal"]["result"]["rootNodeId"].is_null());
    assert_eq!(
        deletion["terminal"]["result"]["materializedTextUtf8Hex"],
        ""
    );
}

#[test]
fn strict_corpus_rejects_unknown_members_codes_and_invocation_lexemes() {
    let mut unknown_member = corpus();
    unknown_member
        .as_object_mut()
        .expect("corpus should be an object")
        .insert("ambientAuthority".to_owned(), Value::Bool(true));
    assert!(validate_oracle_contract(&bytes(&unknown_member)).is_err());

    let mut unknown_code = corpus();
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
    assert!(validate_oracle_contract(&bytes(&unknown_code)).is_err());

    for (field, invalid) in [
        ("bufferId", "AA".repeat(32)),
        ("bufferId", "aa".repeat(31)),
        ("basisHeadId", "gg".repeat(32)),
        ("replacementUtf8Hex", "0".to_owned()),
        ("replacementUtf8Hex", "zz".to_owned()),
        ("replacementUtf8Hex", "ff".to_owned()),
    ] {
        let mut corpus = corpus();
        corpus["cases"][0]["invocation"][field] = Value::String(invalid);
        assert!(
            validate_oracle_contract(&bytes(&corpus)).is_err(),
            "{field} accepted a noncanonical lexeme"
        );
    }
}
