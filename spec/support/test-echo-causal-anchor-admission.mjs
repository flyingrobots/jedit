const INITIAL_ADMISSION_SEQUENCE = 1;
const SEQUENCE_INCREMENT = 1;

export function createTestEchoCausalAnchorAdmissionPort(input = {}) {
  const requests = input.requests ?? [];
  const admit = input.admit ?? defaultAdmission;
  let sequence = INITIAL_ADMISSION_SEQUENCE;

  return {
    admitCheckpointAnchor(request) {
      requests.push(structuredClone(request));
      const result = admit(request, sequence);
      sequence += SEQUENCE_INCREMENT;
      return result;
    },
  };
}

function defaultAdmission(_request, sequence) {
  return {
    ok: true,
    evidence: {
      anchorId: `test-only-anchor:${sequence}`,
      anchorFactId: `test-only-anchor-fact:${sequence}`,
      receiptId: `test-only-anchor-receipt:${sequence}`,
    },
  };
}
