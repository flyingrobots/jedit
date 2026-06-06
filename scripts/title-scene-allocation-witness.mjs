import {
  TITLE_RAY_ALLOCATION_POSTURE,
  createTitleRayAllocationFacts,
} from "../dist/ui/title-allocation-facts.js";

const GC_UNAVAILABLE_NOTE =
  "allocation instrumentation unavailable; rerun with node --expose-gc";
const HEAP_DELTA_NOTE =
  "heap delta measured with forced GC around the measured frame loop";
const ZERO_DELTA_NOTE =
  "forced-GC heap delta was zero; object-level tracing is still required for zero-hot-loop";
const ALLOCATION_EVENT_COUNT = 1;
const ZERO_ALLOCATION_EVENT_COUNT = 0;
const ZERO_ALLOCATED_BYTES = 0;

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
    notes: [HEAP_DELTA_NOTE],
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
  const allocatedBytes = Math.max(
    ZERO_ALLOCATED_BYTES,
    runtime.heapUsed() - measurement.heapUsed,
  );
  return createTitleRayAllocationFacts({
    ...allocationFactsBasis(options),
    allocatedBytes,
    allocationEvents:
      allocatedBytes > ZERO_ALLOCATED_BYTES
        ? ALLOCATION_EVENT_COUNT
        : ZERO_ALLOCATION_EVENT_COUNT,
    posture:
      allocatedBytes > ZERO_ALLOCATED_BYTES
        ? TITLE_RAY_ALLOCATION_POSTURE.Allocating
        : TITLE_RAY_ALLOCATION_POSTURE.BoundedAfterWarmup,
    notes:
      allocatedBytes > ZERO_ALLOCATED_BYTES
        ? measurement.notes
        : [...measurement.notes, ZERO_DELTA_NOTE],
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
