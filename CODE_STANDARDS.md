# Rule 0: Runtime Truth Wins (Non-Negotiable)

When the program is running, only one question matters:

**What is actually true right now, in memory, under execution?**

Everything else — types, tests, docs — is secondary documentation. If they disagree with runtime reality, they are lying. Fix the runtime first.

---

## Core Philosophy

- Truth-seeking over cleverness
- Explicit, boring, and robust
- Immutability by default
- **Hexagonal architecture + Dependency Injection mandatory**
- Portability as a first-class feature
- Small, focused, human-scale code

---

## Mandatory Architectural Rules

**1. Hexagonal Architecture (Ports & Adapters) — Required**
Core domain logic must never depend on host-specific APIs, external libraries with side effects, or concrete implementations. All external capabilities are accessed exclusively through
**ports** (interfaces). Adapters implement those ports for specific environments.

**2. Dependency Injection — Required**
All dependencies are injected via constructors. No `new` of concrete classes inside core. No globals, service locators, or direct imports of adapters in domain code.

**3. Encoding / Decoding Only at Boundaries — Required**
Serialization, deserialization, and codec work must happen **only** in adapters or dedicated boundary codec ports. Core works exclusively with rich domain objects.

---

## Object Model & Modeling Rules

**Prefer classes with constructors for domain concepts.**

All value objects, entities, outcomes, and errors should normally be implemented as classes. This provides:
- Strong invariant enforcement at construction time
- Natural `instanceof` support for runtime dispatch
- RAII-style initialization
- Better protection via `private` fields + `Object.freeze()`

**The lighter "Interface + Factory + Brand" pattern is discouraged** for most domain modeling. It is only allowed for:
- Pure wire/DTO types
- Extremely hot-path primitives (where object allocation matters)
- Cases where you deliberately want structural typing

**Example — Preferred Style (Class)**

```typescript
export class EventId {
  readonly writerId: WriterId;
  readonly lamport: Lamport;

  constructor(writerId: string, lamport: number) {
    this.writerId = WriterId.from(writerId);
    this.lamport = Lamport.from(lamport);
    Object.freeze(this);
  }

  static from(writerId: string, lamport: number): EventId {
    return new EventId(writerId, lamport);
  }

  static is(value: object | null): value is EventId {
    return value instanceof EventId;
  }

  equals(other: EventId): boolean {
    return this.writerId.equals(other.writerId) && this.lamport.equals(other.lamport);
  }
}
```

For cross-realm values, normalize through adapters/boundaries and construct validated domain objects before entering core.

---

## Strict Code Limits (Enforced)

- **File size**: ≤ **500 lines**
- **Function / Method**: ≤ **35 lines** (excluding whitespace & trivial returns)
- **Nesting depth**: ≤ **4**
- **Cyclomatic complexity**: ≤ **8**
- **Parameters**: ≤ **5** (use a named options class/object otherwise)
- **Class size**: ≤ **400 lines**, ≤ **15 public methods**
- One primary domain concept per file
- Max 12 imports per file

---

## Language Policy

**Banned without exception:**
- `any`
- `unknown`
- Type assertions (`as`)
- `enum`
- `throw new Error("string")`
- Magic numbers/strings
- Boolean trap parameters
- Anonymous option bags in public APIs

**Encouraged:**
- Constructor-based validation
- `readonly` + `private` + `Object.freeze()`
- Domain-specific error classes
- Polymorphism over type-tag switching

---

## flyingrobots's Principles

**P1:** Domain concepts with invariants or behavior deserve runtime-backed classes.
**P2:** Validation happens at construction and system boundaries.
**P3:** Behavior belongs on the type that owns it.
**P4:** Schemas (Zod etc.) are boundary guards only.
**P5:** Encoding/decoding is codec/adapter territory.
**P6:** Immutability by default.
**P7:** Determinism & replayability (ClockPort, RandomPort, etc.).
**P8:** Single source of truth = the runtime model.
**P9:** Runtime dispatch (`instanceof`) when inside the same realm; for cross-realm values, normalize at the boundary before constructing domain types instead of relying on class identity.

---

## Sample ESLint Rules

```json
{
  "rules": {
    "max-lines": ["error", 500],
    "max-lines-per-function": ["error", { "max": 35, "skipBlankLines": true, "skipComments": true }],
    "max-depth": ["error", 4],
    "max-params": ["error", 5],
    "complexity": ["error", 8],
    "max-statements": ["error", 25],

    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-restricted-types": [
      "error",
      {
        "types": {
          "unknown": "Use a concrete type instead of unknown"
        }
      }
    ],
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/only-throw-error": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-floating-promises": "error"
  }
}
```

---

## Review Checklist (Mandatory on Every PR)

- Follows hexagonal architecture?
- Dependencies properly injected?
- Encoding/decoding only at boundaries?
- File ≤ 500 lines? Functions ≤ 35 lines & depth ≤ 4?
- Important domain concepts modeled as classes with constructor validation?
- Invariants protected? Free of `any`, `unknown`, and unsafe `as` assertions?
- Could the core run in a browser?
- Time, randomness, and side effects properly abstracted?

---

**This is infrastructure.**

It should feel like a well-engineered, inspectable, long-lived machine rather than clever glue code.

**My final opinion:** This standard is opinionated and strict for good reason. It trades some short-term velocity for massive gains in correctness, debuggability, and survivability over
years. The combination of **Runtime Truth**, **Hexagonal + DI**, **strict limits**, and **class-based domain modeling** makes it one of the strongest TypeScript standards for serious
systems work.

Use it where the code must last. Enforce it consistently. Improve it thoughtfully.
