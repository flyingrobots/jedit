// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import { createHash } from "node:crypto";

import { encode } from "cbor-x";

export function canonicalArtifactDigest(domain, canonicalArtifactBytes) {
  const preimage = Buffer.concat([
    Buffer.from([0x83]),
    Buffer.from(encode("edict.digest/v1")),
    Buffer.from(encode(domain)),
    Buffer.from(canonicalArtifactBytes),
  ]);
  return createHash("sha256").update(preimage).digest();
}

export function digestText(bytes) {
  return `sha256:${Buffer.from(bytes).toString("hex")}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function resourceReference(reference) {
  return {
    coordinate: reference.id,
    digest: digestText(reference.digest[1]),
  };
}

export function verificationEvidence({
  executableSubjectId,
  provider,
  reportArtifactId,
  report,
}) {
  const envelope = {
    apiVersion: "jedit.edict-verification-evidence/v1",
    reportArtifact: reportArtifactId,
    executableSubject: executableSubjectId,
    providerRelease: {
      coordinate: provider.coordinate,
      digest: provider.digest,
    },
    verifierComponent: {
      coordinate: provider.verifier.coordinate,
      digest: `sha256:${provider.verifier.sha256}`,
    },
    verificationPolicy: {
      apiVersion: "jedit.edict-verification-policy/v1",
      verifierContract: provider.verifier.contract,
      targetProfile: provider.targetProfile,
      reportAbi: report.apiVersion,
      diagnosticAbi: resourceReference(report.diagnosticAbi),
    },
    outcome: report.outcome,
  };
  const bytes = Buffer.from(JSON.stringify(canonicalJson(envelope)), "utf8");
  return {
    envelope,
    bytes,
    identity: {
      coordinate: "jedit.edict-verification-evidence/v1",
      domain: "jedit.edict-verification-evidence/v1",
      digest: digestText(
        canonicalArtifactDigest("jedit.edict-verification-evidence/v1", bytes),
      ),
      rawSha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}
