// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! The schema-2 row runner (#296). It runs the locked ReplaceRange package
//! over every runtime case and writes one observation per case for
//! tests/run-rows.mjs to judge. It needs a package that Echo admits; until
//! then it refuses to run rather than pass.
mod cases;
mod runner;

use echo_edict_canonical::{encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value};
use runner::{run, Case, PackageUnderTest};
use serde_json::{json, Value as Json};
use std::{env, fs};
use warp_core::edict_effects::EffectMutation;
use warp_core::edict_pure::EvaluationLimits;
use warp_core::{NodeId, TypeId};

const OPERATION: &str = "jedit.text.replace_range@2.replaceRange";
const AUTHORITY: &[u8] = b"jedit.text.authority/v2";
const REFERENCE_STEPS: u64 = 9_007_199_254_740_991;
const FRAME_STEPS: u64 = 1_048_576;
const READ_WRITE_CEILING: u64 = 4_194_304;
const EFFECT_ALLOCATION_CEILING: u64 = 16_777_216;
const SLOT_NODE: u8 = 0;
const SLOT_RANGE: u8 = 3;

fn hex32(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

fn input(fields: &Json) -> Vec<u8> {
    let text = |key: &str| fields[key].as_str().expect("input field").to_owned();
    let integer = |key: &str| Value::Integer(text(key).parse::<u64>().expect("u64 field").into());
    encode(&Value::Map(vec![
        (Value::Text("warpId".into()), Value::Bytes(cases::id(&text("warpId")).to_vec())),
        (Value::Text("bufferId".into()), Value::Bytes(cases::id(&text("bufferId")).to_vec())),
        (Value::Text("basisHeadId".into()), Value::Bytes(cases::id(&text("basisHeadId")).to_vec())),
        (Value::Text("startByte".into()), integer("startByte")),
        (Value::Text("endByte".into()), integer("endByte")),
        (
            Value::Text("replacement".into()),
            Value::Bytes(hex::decode(text("replacementHex")).expect("replacement hex")),
        ),
    ]))
    .expect("canonical input")
}

fn effect(mutation: &EffectMutation) -> Json {
    match mutation {
        EffectMutation::EnsureNode { node, ty, atom } | EffectMutation::CreateNode { node, ty, atom } => json!({
            "kind": "EnsureNode", "node": hex32(&node.local_id.0), "nodeType": hex32(&ty.0),
            "atomType": hex32(&atom.type_id.0), "atomHex": hex::encode(&atom.bytes),
        }),
        EffectMutation::ReplaceAtom { node, expected, atom } => json!({
            "kind": "ReplaceAtom", "node": hex32(&node.local_id.0), "expectedAtomDigest": hex32(expected),
            "atomType": hex32(&atom.type_id.0), "atomHex": hex::encode(&atom.bytes),
        }),
        EffectMutation::EnsureEdge { edge, from, to, ty } => json!({
            "kind": "EnsureEdge", "edge": hex32(&edge.local_id.0), "from": hex32(&from.0),
            "edgeType": hex32(&ty.0), "to": hex32(&to.0),
        }),
        EffectMutation::ReplaceEdge { edge, expected_to, to } => json!({
            "kind": "ReplaceEdge", "edge": hex32(&edge.local_id.0), "expectedTo": hex32(&expected_to.0),
            "to": hex32(&to.0),
        }),
    }
}

fn observe(case: &Json, package: &PackageUnderTest, edge_types: &[TypeId]) -> Json {
    let loaded = cases::load(&case.to_string());
    let typed_input = input(&loaded.input);
    let buffer = NodeId(cases::id(case["input"]["bufferId"].as_str().expect("bufferId")));
    let buffer_type = loaded.nodes.iter().find(|node| node.id == buffer).map(|node| node.ty);
    let Some(buffer_type) = buffer_type else {
        // A missing Buffer is decided by the program's own read; root the graph elsewhere.
        return json!({ "id": case["id"], "executed": false, "reason": "no Buffer node to root the case" });
    };
    let runtime_case = Case {
        warp: loaded.warp,
        root: buffer,
        nodes: loaded.nodes,
        edges: loaded.edges,
        edge_types: edge_types.to_vec(),
        max_edge_scans: 64,
        typed_reads: vec![(buffer, buffer_type)],
        input: typed_input,
    };
    let observation = run(&runtime_case, package);
    let names: std::collections::BTreeMap<String, String> = case["edgeTypeNames"]
        .as_object()
        .map(|names| names.iter().map(|(id, name)| (id.clone(), name.as_str().unwrap_or("").to_owned())).collect())
        .unwrap_or_default();
    let nodes: Vec<String> = observation
        .reads
        .iter()
        .filter(|(class, _, _)| *class == SLOT_NODE)
        .map(|(_, id, _)| hex32(id))
        .collect();
    let ranges: Vec<Json> = observation
        .reads
        .iter()
        .filter(|(class, _, _)| *class == SLOT_RANGE)
        .map(|(_, id, ty)| json!({ "from": hex32(id), "type": names.get(&hex32(ty)).cloned().unwrap_or(hex32(ty)) }))
        .collect();
    json!({
        "id": case["id"],
        "executed": true,
        "output": match &observation.output { Ok(bytes) => json!(hex::encode(bytes)), Err(error) => json!(format!("{error:?}")) },
        "effects": observation.mutations.iter().map(effect).collect::<Vec<_>>(),
        "readSet": { "nodes": nodes, "edgeRanges": ranges },
        "derivedOperations": observation.derived_ops.map(|ops| match ops { Ok(count) => json!(count), Err(error) => json!(error) }),
    })
}

#[test]
#[ignore = "needs an admitted ReplaceRange package; run through tests/run-rows.mjs"]
fn every_runtime_case_runs_against_the_locked_package() {
    let (Ok(package_path), Ok(pin), Ok(cases_path), Ok(out)) = (
        env::var("JEDIT_ROPE_PACKAGE"),
        env::var("JEDIT_ROPE_PACKAGE_PIN"),
        env::var("JEDIT_ROPE_CASES"),
        env::var("JEDIT_ROPE_OBSERVATIONS"),
    ) else {
        panic!("the row runner needs JEDIT_ROPE_PACKAGE, _PACKAGE_PIN, _CASES and _OBSERVATIONS");
    };
    let package = PackageUnderTest {
        bytes: fs::read(package_path).expect("package"),
        pin: cases::id(&pin),
        operation: OPERATION,
        authority_label: AUTHORITY,
        budget: (REFERENCE_STEPS, READ_WRITE_CEILING, READ_WRITE_CEILING),
        delegated: (FRAME_STEPS, READ_WRITE_CEILING, READ_WRITE_CEILING),
        limits: EvaluationLimits {
            max_package_bytes: 4_194_304,
            max_input_bytes: 65_536,
            max_steps: FRAME_STEPS,
            max_allocated_bytes: EFFECT_ALLOCATION_CEILING,
            max_output_bytes: 4096,
        },
    };
    let all: Vec<Json> = serde_json::from_str(&fs::read_to_string(cases_path).expect("cases")).expect("cases json");
    let edge_types: Vec<TypeId> = all[0]["edgeTypeIds"]
        .as_array()
        .expect("edge type ids")
        .iter()
        .map(|id| TypeId(cases::id(id.as_str().expect("edge type id"))))
        .collect();
    let observations: Vec<Json> = all.iter().map(|case| observe(case, &package, &edge_types)).collect();
    fs::write(out, serde_json::to_string_pretty(&observations).expect("observations")).expect("write");
    println!("JEDIT_ROPE_ROWS_OBSERVED {}", observations.len());
}
