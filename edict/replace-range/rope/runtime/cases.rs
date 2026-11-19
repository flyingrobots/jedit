// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! Loads a runtime case written by tests/runtime-cases.mjs into the
//! consumer's graph form. Only nodes ordinary admission accepts are
//! installed here; raw-store witnesses are installed by their own rows.
use crate::runner::{edge, CaseNode};
use serde_json::Value as Json;
use warp_core::{EdgeRecord, NodeId, TypeId, WarpId};

pub fn id(text: &str) -> [u8; 32] {
    hex::decode(text).expect("id hex").try_into().expect("32-byte id")
}

fn field<'a>(value: &'a Json, key: &str) -> &'a str {
    value[key].as_str().unwrap_or_else(|| panic!("case field {key}"))
}

pub struct LoadedCase {
    pub warp: WarpId,
    pub nodes: Vec<CaseNode>,
    pub edges: Vec<EdgeRecord>,
    pub input: Json,
}

pub fn load(text: &str) -> LoadedCase {
    let case: Json = serde_json::from_str(text).expect("case json");
    let graph = &case["graph"];
    let nodes = graph["nodes"]
        .as_array()
        .expect("nodes")
        .iter()
        .filter(|node| field(node, "install") == "bridge")
        .map(|node| CaseNode {
            id: NodeId(id(field(node, "id"))),
            ty: TypeId(id(field(node, "nodeType"))),
            atom: Some((
                TypeId(id(field(node, "atomType"))),
                hex::decode(field(node, "atomHex")).expect("atom hex"),
            )),
        })
        .collect();
    let edges = graph["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|record| {
            edge(
                id(field(record, "id")),
                NodeId(id(field(record, "from"))),
                NodeId(id(field(record, "to"))),
                TypeId(id(field(record, "edgeType"))),
            )
        })
        .collect();
    LoadedCase {
        warp: WarpId(id(field(graph, "warpId"))),
        nodes,
        edges,
        input: case["input"].clone(),
    }
}
