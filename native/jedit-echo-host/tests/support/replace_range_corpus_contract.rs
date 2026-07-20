use serde_json::{Map, Value};

use super::contract::SemanticObstructionCode;

pub fn validate_oracle_contract(corpus: &Value) -> Result<(), String> {
    let root = exact_fields(
        corpus,
        &[
            "schemaVersion",
            "coordinate",
            "applicationSchemaCoordinate",
            "invocationSchemaCoordinate",
            "semanticBaselineCommit",
            "sourceSet",
            "evidenceGrade",
            "independenceLimit",
            "warpId",
            "cases",
        ],
    )?;
    exact_fields(
        field(root, "sourceSet")?,
        &["algorithm", "domainHex", "framing", "paths", "digestHex"],
    )?;
    let cases = field(root, "cases")?
        .as_array()
        .ok_or_else(|| "cases must be an array".to_owned())?;
    for case in cases {
        validate_oracle_case(case)?;
    }
    Ok(())
}

fn validate_oracle_case(case: &Value) -> Result<(), String> {
    let case = exact_fields(
        case,
        &[
            "id",
            "purpose",
            "basisFacts",
            "invocation",
            "invocationBytesHex",
            "terminal",
        ],
    )?;
    for fact in field(case, "basisFacts")?
        .as_array()
        .ok_or_else(|| "basisFacts must be an array".to_owned())?
    {
        exact_fields(fact, &["nodeId", "typeId", "attachmentBytesHex"])?;
    }
    let invocation = exact_fields(
        field(case, "invocation")?,
        &[
            "bufferId",
            "basisHeadId",
            "startByte",
            "endByte",
            "replacementUtf8Hex",
        ],
    )?;
    validate_node_id(field(invocation, "bufferId")?, "bufferId")?;
    validate_node_id(field(invocation, "basisHeadId")?, "basisHeadId")?;
    field(invocation, "startByte")?
        .as_u64()
        .ok_or_else(|| "startByte must be a u64 JSON decimal".to_owned())?;
    field(invocation, "endByte")?
        .as_u64()
        .ok_or_else(|| "endByte must be a u64 JSON decimal".to_owned())?;
    let replacement = decode_lowercase_hex(
        field(invocation, "replacementUtf8Hex")?,
        "replacementUtf8Hex",
    )?;
    std::str::from_utf8(&replacement)
        .map_err(|_| "replacementUtf8Hex must encode UTF-8".to_owned())?;
    validate_terminal(field(case, "terminal")?)
}

fn validate_node_id(value: &Value, label: &str) -> Result<(), String> {
    let bytes = decode_lowercase_hex(value, label)?;
    if bytes.len() != 32 {
        return Err(format!("{label} must encode exactly 32 bytes"));
    }
    Ok(())
}

fn decode_lowercase_hex(value: &Value, label: &str) -> Result<Vec<u8>, String> {
    let value = value
        .as_str()
        .ok_or_else(|| format!("{label} must be a string"))?;
    if value.len() % 2 != 0 {
        return Err(format!("{label} must contain an even number of digits"));
    }
    if !value
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(format!("{label} must contain lowercase hexadecimal only"));
    }
    hex::decode(value).map_err(|error| format!("{label} must decode: {error}"))
}

fn validate_terminal(terminal: &Value) -> Result<(), String> {
    match terminal["posture"].as_str() {
        Some("committable") => validate_committable(terminal),
        Some("obstructed") => validate_obstructed(terminal),
        Some(posture) => Err(format!("unknown terminal posture {posture}")),
        None => Err("terminal posture must be a string".to_owned()),
    }
}

fn validate_committable(terminal: &Value) -> Result<(), String> {
    let terminal = exact_fields(
        terminal,
        &[
            "posture",
            "footprint",
            "patch",
            "createdNodeIds",
            "updatedNodeIds",
            "untouchedBasisNodeIds",
            "result",
        ],
    )?;
    exact_fields(
        field(terminal, "footprint")?,
        &[
            "nodeReads",
            "nodeWrites",
            "attachmentReads",
            "attachmentWrites",
            "edgeReads",
            "edgeWrites",
        ],
    )?;
    for operation in field(terminal, "patch")?
        .as_array()
        .ok_or_else(|| "patch must be an array".to_owned())?
    {
        validate_patch_operation(operation)?;
    }
    exact_fields(
        field(terminal, "result")?,
        &[
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
            "materializedTextUtf8Hex",
        ],
    )?;
    Ok(())
}

fn validate_obstructed(terminal: &Value) -> Result<(), String> {
    let terminal = exact_fields(
        terminal,
        &[
            "posture",
            "semanticCode",
            "legacyErrorClass",
            "legacyMessage",
            "parentGraphUnchanged",
            "patchPosture",
        ],
    )?;
    serde_json::from_value::<SemanticObstructionCode>(field(terminal, "semanticCode")?.clone())
        .map_err(|error| format!("invalid semanticCode: {error}"))?;
    Ok(())
}

fn validate_patch_operation(operation: &Value) -> Result<(), String> {
    match operation["kind"].as_str() {
        Some("upsert-node") => {
            exact_fields(operation, &["kind", "nodeId", "typeId"])?;
            Ok(())
        }
        Some("set-node-alpha") => {
            exact_fields(
                operation,
                &["kind", "nodeId", "typeId", "attachmentBytesHex"],
            )?;
            Ok(())
        }
        Some(kind) => Err(format!("unknown patch kind {kind}")),
        None => Err("patch kind must be a string".to_owned()),
    }
}

fn exact_fields<'a>(value: &'a Value, expected: &[&str]) -> Result<&'a Map<String, Value>, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "contract value must be an object".to_owned())?;
    let mut actual = object.keys().map(String::as_str).collect::<Vec<_>>();
    actual.sort_unstable();
    let mut expected = expected.to_vec();
    expected.sort_unstable();
    if actual != expected {
        return Err(format!(
            "object fields differ: expected {expected:?}, received {actual:?}"
        ));
    }
    Ok(object)
}

fn field<'a>(object: &'a Map<String, Value>, name: &str) -> Result<&'a Value, String> {
    object
        .get(name)
        .ok_or_else(|| format!("missing required field {name}"))
}
