import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./workspace-helpers.mjs";

test("agent strand sessions derive an isolated graph universe and braid admission target", async () => {
  const contract = await importDist("ports", "jedit-agent-strand-contract.js");

  const result = contract.createJeditAgentStrandSession({
    agentId: "codex",
    sessionId: "session-42",
    basis: "main@t1904",
    capabilities: ["replaceRange", "readProjection"],
    rationale: "propose doc edits",
  });

  assert.equal(result.status, contract.JeditAgentStrandStatuses.Ready);
  assert.equal(result.session.strand, "agent/codex/session-42");
  assert.equal(result.session.graphUniverseId, "graph:agent/codex/session-42");
  assert.equal(result.session.admissionTarget, "main");
  assert.equal(result.session.receiptPolicy, "required");
  assert.equal(result.session.canonicalWritePolicy, "braid-admission-only");
  assert.deepEqual(result.session.capabilities, ["replaceRange", "readProjection"]);
});

test("agent intent envelopes require a receipt-backed private strand session", async () => {
  const contract = await importDist("ports", "jedit-agent-strand-contract.js");
  const sessionResult = contract.createJeditAgentStrandSession({
    agentId: "mcp-agent",
    sessionId: "abc",
    basis: "main@t7",
    strand: "agent/mcp/abc",
  });

  const envelope = contract.createJeditAgentIntentEnvelope(sessionResult.session, {
    kind: "replaceRange",
    path: "src/foo.ts",
    affectedRanges: [{
      path: "src/foo.ts",
      startLine: 10,
      endLine: 12,
    }],
  });
  const preview = contract.createJeditAgentBraidPreviewRequest(sessionResult.session);
  const admission = contract.createJeditAgentAdmissionRequest(sessionResult.session, "braid:abc");

  assert.equal(envelope.operation, contract.JeditAgentStrandOperations.SubmitIntent);
  assert.equal(envelope.receiptPolicy, "required");
  assert.equal(envelope.session.strand, "agent/mcp/abc");
  assert.deepEqual(preview.members, ["main", "agent/mcp/abc"]);
  assert.equal(preview.admissionTarget, "main");
  assert.equal(admission.operation, contract.JeditAgentStrandOperations.RequestAdmission);
  assert.equal(admission.braidId, "braid:abc");
});

test("agent strand sessions reject missing identity or basis coordinates", async () => {
  const contract = await importDist("ports", "jedit-agent-strand-contract.js");

  assert.deepEqual(
    contract.createJeditAgentStrandSession({
      agentId: "",
      sessionId: "session-1",
      basis: "main@t1",
    }),
    {
      status: contract.JeditAgentStrandStatuses.Invalid,
      reason: "agentId is required",
    },
  );
  assert.deepEqual(
    contract.createJeditAgentStrandSession({
      agentId: "codex",
      sessionId: "session-1",
      basis: "",
    }),
    {
      status: contract.JeditAgentStrandStatuses.Invalid,
      reason: "basis is required",
    },
  );
});
