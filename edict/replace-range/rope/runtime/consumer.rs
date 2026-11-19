// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
//! The row runner's runtime consumer, proved on Echo's retained public
//! graph-read package before a ReplaceRange package is admitted (#296).
mod cases;
mod runner;

use echo_edict_canonical::{encode_canonical_cbor_v1 as encode, CanonicalValueV1 as Value};
use runner::{edge, hash, run, Case, CaseNode, PackageUnderTest};
use warp_core::edict_effects::EffectMutation;
use warp_core::edict_pure::EvaluationLimits;
use warp_core::{EdgeKey, NodeId, TypeId, WarpId};

const LINK_PACKAGE: &str = include_str!("fixtures/link-executable-operation-package.hex");
const LINK_PIN: &str = "31c092bec1c0b3a061232e01ab0fa2943469f22324f5e240f2d30d6fb1dbe4c1";
const WARP: WarpId = WarpId([0x61; 32]);
const NODE_TYPE: TypeId = TypeId([0x6b; 32]);
const PORTAL_TYPE: TypeId = TypeId([0x6c; 32]);
const EDGE_TYPE: TypeId = TypeId([0x6d; 32]);
const ROOT: NodeId = NodeId([0x62; 32]);
const SOURCE: NodeId = NodeId([0x63; 32]);
const TARGET: NodeId = NodeId([0x64; 32]);
const FROM: NodeId = NodeId([0x65; 32]);

fn pin(text: &str) -> [u8; 32] {
    hex::decode(text).expect("pin hex").try_into().expect("32-byte pin")
}

fn text(value: &str) -> Value {
    Value::Text(value.into())
}

fn bytes(value: impl AsRef<[u8]>) -> Value {
    Value::Bytes(value.as_ref().to_vec())
}

fn link_package() -> PackageUnderTest {
    PackageUnderTest {
        bytes: hex::decode(LINK_PACKAGE.trim()).expect("package hex"),
        pin: pin(LINK_PIN),
        operation: "consumer.links.program@1.link",
        authority_label: b"consumer.links.authority/v1",
        budget: (16_384, 4096, 4096),
        delegated: (16_384, 4096, 4096),
        limits: EvaluationLimits {
            max_package_bytes: 1_048_576,
            max_input_bytes: 65_536,
            max_steps: 16_384,
            max_allocated_bytes: 1_048_576,
            max_output_bytes: 65_536,
        },
    }
}

/// The link program's graph: a portal-typed root, the source with one `E`
/// edge to the target, and the node it links from.
fn link_case() -> Case {
    let node = |id| CaseNode { id, ty: NODE_TYPE, atom: None };
    let new_edge = warp_core::content_address_v1::slot_edge_id(WARP, FROM, EDGE_TYPE);
    let field = |key: &str, value| (text(key), value);
    let input = encode(&Value::Map(vec![
        field("anchor", bytes([0x5a; 32])),
        field(
            "read",
            Value::Map(vec![
                field("edgeType", bytes(EDGE_TYPE.0)),
                field("nodeId", bytes(SOURCE.0)),
                field("warpId", bytes(WARP.0)),
            ]),
        ),
        field("edgeId", bytes(new_edge.0)),
        field("fromId", bytes(FROM.0)),
    ]))
    .expect("canonical input");
    Case {
        warp: WARP,
        root: ROOT,
        nodes: vec![
            CaseNode { id: ROOT, ty: PORTAL_TYPE, atom: None },
            node(SOURCE),
            node(TARGET),
            node(FROM),
        ],
        edges: vec![edge([0x66; 32], SOURCE, TARGET, EDGE_TYPE)],
        edge_types: vec![EDGE_TYPE],
        max_edge_scans: 8,
        typed_reads: vec![(SOURCE, NODE_TYPE)],
        input,
    }
}

#[test]
fn the_consumer_runs_an_admitted_public_effect_package_end_to_end() {
    let package = link_package();
    assert_eq!(hash(b"echo:operation-package:v1\0", &package.bytes), package.pin);
    let observation = run(&link_case(), &package);
    assert!(observation.output.is_ok(), "{:?}", observation.output);
    assert_eq!(
        observation.mutations,
        [EffectMutation::EnsureEdge {
            edge: EdgeKey {
                warp_id: WARP,
                local_id: warp_core::content_address_v1::slot_edge_id(WARP, FROM, EDGE_TYPE),
            },
            from: FROM,
            to: TARGET,
            ty: EDGE_TYPE,
        }]
    );
    assert!(matches!(observation.derived_ops, Some(Ok(ops)) if ops > 0), "a derived patch");
    println!("JEDIT_ROPE_RUNTIME_CONSUMER_OK");
}

const WITNESS_PACKAGE: &str = include_str!("fixtures/basis-read-executable-operation-package.hex");
const WITNESS_PIN: &str = "9e12fee17830a87763b0eb90463aa9ef4199fb6e9f794ccb7097a22d7b176683";
const MIDDLE_ASCII_INSERT: &str = include_str!("fixtures/middle-ascii-insert.case.json");
/// The jedit.text@2 reference step ceiling and the Echo effect allocation ceiling.
const REFERENCE_STEPS: u64 = 9_007_199_254_740_991;
const EFFECT_ALLOCATION_CEILING: u64 = 16_777_216;
const READ_WRITE_CEILING: u64 = 4_194_304;
/// Echo's per-frame step ceiling; the invocation delegates at most this.
const FRAME_STEPS: u64 = 1_048_576;

/// The basis-read witness over the `middle-ascii-insert` row's basis: it reads
/// the Buffer atom and its canonicalHead and returns the head it names.
#[test]
fn the_admitted_basis_read_witness_reads_the_rows_canonical_head() {
    let loaded = cases::load(MIDDLE_ASCII_INSERT);
    let field = |key: &str| loaded.input[key].as_str().expect("input field").to_owned();
    let buffer = NodeId(cases::id(&field("bufferId")));
    let basis = cases::id(&field("basisHeadId"));
    let buffer_type = loaded.nodes.iter().find(|node| node.id == buffer).expect("buffer node").ty;
    let canonical_type = loaded
        .edges
        .iter()
        .find(|record| record.from == buffer && record.to == NodeId(basis))
        .expect("canonicalHead edge")
        .ty;
    let input = encode(&Value::Map(vec![
        (text("basisHeadId"), bytes(basis)),
        (text("bufferId"), bytes(buffer.0)),
        (text("warpId"), bytes(loaded.warp.0)),
    ]))
    .expect("canonical input");
    let package_bytes = hex::decode(WITNESS_PACKAGE.trim()).expect("package hex");
    println!("witness package identity {}", hex::encode(hash(b"echo:operation-package:v1\0", &package_bytes)));
    let package = PackageUnderTest {
        bytes: package_bytes,
        pin: pin(WITNESS_PIN),
        operation: "jedit.text.basis_read@1.basisRead",
        authority_label: b"jedit.text.authority/v2",
        budget: (REFERENCE_STEPS, READ_WRITE_CEILING, READ_WRITE_CEILING),
        delegated: (FRAME_STEPS, READ_WRITE_CEILING, READ_WRITE_CEILING),
        limits: EvaluationLimits {
            max_package_bytes: 1_048_576,
            max_input_bytes: 65_536,
            max_steps: 1_048_576,
            max_allocated_bytes: EFFECT_ALLOCATION_CEILING,
            max_output_bytes: 4096,
        },
    };
    let case = Case {
        warp: loaded.warp,
        root: buffer,
        nodes: loaded.nodes,
        edges: loaded.edges,
        edge_types: vec![canonical_type],
        max_edge_scans: 64,
        typed_reads: vec![(buffer, buffer_type)],
        input,
    };
    let observation = run(&case, &package);
    assert_eq!(observation.output, Ok(encode(&bytes(basis)).expect("canonical head id")));
    assert!(observation.mutations.is_empty(), "a read-only witness proposes no mutation");
    println!("JEDIT_ROPE_BASIS_READ_WITNESS_OK derived={:?}", observation.derived_ops);
}
