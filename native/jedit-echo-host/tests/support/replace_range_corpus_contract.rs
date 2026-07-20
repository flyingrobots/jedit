use serde_json::{Map, Value};

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
    exact_fields(
        field(case, "invocation")?,
        &[
            "bufferId",
            "basisHeadId",
            "startByte",
            "endByte",
            "replacementUtf8Hex",
        ],
    )?;
    validate_terminal(field(case, "terminal")?)
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
    const CODES: &[&str] = &[
        "range-order-invalid",
        "range-out-of-bounds",
        "utf8-boundary-invalid",
        "no-op",
        "basis-not-canonical",
        "arithmetic-overflow",
        "fact-missing",
        "fact-malformed",
        "content-identity-mismatch",
        "malformed-rope",
    ];
    let code = field(terminal, "semanticCode")?
        .as_str()
        .ok_or_else(|| "semanticCode must be a string".to_owned())?;
    if !CODES.contains(&code) {
        return Err(format!("unknown semanticCode {code}"));
    }
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
