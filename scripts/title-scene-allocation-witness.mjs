import {
  TITLE_RAY_ALLOCATION_POSTURE,
  createTitleRayAllocationFacts,
} from "../dist/ui/title-allocation-facts.js";

const GC_UNAVAILABLE_NOTE =
  "allocation instrumentation unavailable; rerun with node --expose-gc";
const RETAINED_HEAP_DELTA_NOTE =
  "retained heap delta measured with forced GC around the measured frame loop";
const ZERO_RETAINED_HEAP_DELTA_NOTE =
  "forced-GC retained heap delta was zero; allocation events remain unmeasured";
const ZERO_RETAINED_HEAP_DELTA_BYTES = 0;

export function startTitleAllocationMeasurement(runtime = titleAllocationRuntime()) {
  if (runtime.collectGarbage == null) {
    return {
      kind: "unmeasured",
      notes: [GC_UNAVAILABLE_NOTE],
    };
  }
  runtime.collectGarbage();
  return {
    kind: "started",
    heapUsed: runtime.heapUsed(),
    notes: [RETAINED_HEAP_DELTA_NOTE],
  };
}

export function finishTitleAllocationMeasurement(
  options,
  measurement,
  runtime = titleAllocationRuntime(),
) {
  if (measurement.kind === "unmeasured" || runtime.collectGarbage == null) {
    return createTitleRayAllocationFacts({
      ...allocationFactsBasis(options),
      posture: TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
      notes: measurement.notes,
    });
  }
  runtime.collectGarbage();
  const retainedHeapDeltaBytes = Math.max(
    ZERO_RETAINED_HEAP_DELTA_BYTES,
    runtime.heapUsed() - measurement.heapUsed,
  );
  return createTitleRayAllocationFacts({
    ...allocationFactsBasis(options),
    retainedHeapDeltaBytes,
    posture:
      retainedHeapDeltaBytes > ZERO_RETAINED_HEAP_DELTA_BYTES
        ? TITLE_RAY_ALLOCATION_POSTURE.Allocating
        : TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
    notes:
      retainedHeapDeltaBytes > ZERO_RETAINED_HEAP_DELTA_BYTES
        ? measurement.notes
        : [...measurement.notes, ZERO_RETAINED_HEAP_DELTA_NOTE],
  });
}

function allocationFactsBasis(options) {
  return {
    width: options.width,
    height: options.height,
    renderMode: options.renderMode,
    warmupFrames: options.warmupFrames,
    measuredFrames: options.frames,
  };
}

function titleAllocationRuntime() {
  const collectGarbage =
    typeof globalThis.gc === "function" ? () => globalThis.gc() : undefined;
  return {
    collectGarbage,
    heapUsed: () => process.memoryUsage().heapUsed,
  };
}
