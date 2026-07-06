---

inclusion: always

---
# Engineering Development Principles

## The Iron Law

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

No feature, bug fix, optimization, refactor, integration, infrastructure change, configuration change, or API modification may be implemented before a failing test defines the expected behavior.

If production code exists without a corresponding failing test written first, remove the implementation and rebuild it using the **RED → GREEN → REFACTOR** cycle.

This rule applies to every part of the codebase.

---

# Public APIs are Contracts

Every exported or externally accessible API is a public contract.

Before introducing or modifying a public API:

1. Write a failing behavioral test.
2. Validate the API design.
3. Implement the smallest behavior required.
4. Refactor only after all tests pass.

Changing a public API after release is significantly more expensive than changing an internal implementation.

Design APIs deliberately before implementing them.

---

# RFC Before Implementation

Significant architectural work must begin with an approved RFC (Request for Comments).

Examples include:

* new modules or packages
* architectural changes
* infrastructure changes
* routing
* middleware or pipelines
* dependency injection
* event systems
* plugins or extensions
* runtime behavior
* storage architecture
* caching strategy
* messaging or queues
* public APIs
* security architecture
* deployment architecture
* major third-party integrations

Implementation begins only after the RFC has been reviewed and approved.

The RFC defines the architecture.

TDD validates the implementation.

---

# RED → GREEN → REFACTOR

Every behavior follows the same development cycle.

## 1. RED

Write exactly one failing test describing a single behavior.

Keep the scope intentionally small.

Verify the test fails for the expected reason.

---

## 2. GREEN

Write the minimum implementation required to satisfy the test.

Do not implement future behavior.

Do not optimize.

Do not generalize.

Do not add convenience features.

---

## 3. REFACTOR

Improve:

* naming
* duplication
* structure
* readability
* maintainability

Behavior must remain unchanged.

Run the affected tests after every refactoring step.

---

## 4. COMMIT

A complete RED → GREEN → REFACTOR cycle should normally produce one coherent, revertible commit.

---

# Build the Foundation First

Complex systems should be implemented from the lowest layer upward.

Avoid beginning with user-facing APIs.

Implement in dependency order whenever practical.

Typical layering:

```text
Core Primitives
        ↓
Internal Components
        ↓
Business Logic
        ↓
Public Interfaces
        ↓
Examples / Applications
```

Higher layers should depend on stable lower layers—not the other way around.

---

# Characterize Before Refactoring

When modifying existing behavior:

1. Write characterization tests describing the current behavior.
2. Verify they pass.
3. Refactor safely.
4. Replace obsolete implementation.
5. Preserve behavior unless change is intentional.

Never delete tests simply because they fail after refactoring.

Improve weak tests instead of removing them.

Coverage must never decrease for modified code.

---

# Behavior-Driven Testing

Tests should verify observable behavior.

Avoid coupling tests to implementation details.

Good tests verify:

* business behavior
* user-visible functionality
* API behavior
* validation
* persistence
* integrations
* workflows
* error handling
* authorization
* concurrency
* events
* state transitions
* performance expectations where appropriate

Poor tests verify:

* private methods
* internal variables
* helper functions
* implementation order
* hidden object structures
* internal algorithms that are not externally observable

Test behavior.

Never implementation.

---

# Consistency Across Implementations

Multiple implementations of the same interface or contract must behave consistently.

When introducing an alternative implementation, backend, runtime, provider, or integration, execute the same behavioral test suite against every implementation.

Correctness is defined by identical observable behavior—not identical implementation.

---

# Backward Compatibility

Every bug fix must introduce a regression test.

Released public APIs should remain backward compatible unless an intentional breaking change has been approved.

Every production bug becomes a permanent test.

---

# Performance Follows Correctness

Do not optimize before correctness has been established.

Implementation order is always:

1. Correctness
2. Tests
3. Functional consistency
4. Measurement
5. Optimization

Every optimization must preserve observable behavior.

Measure before optimizing.

---

# Definition of Done

A change is complete only when:

* [ ] A failing test specified the behavior before implementation.
* [ ] The smallest implementation satisfies the requirement.
* [ ] All affected tests pass.
* [ ] Coverage does not decrease for modified code.
* [ ] Significant architectural changes were RFC-approved.
* [ ] All implementations remain behaviorally consistent.
* [ ] No implementation-detail tests were introduced.
* [ ] No speculative features or unnecessary abstractions were added.
* [ ] Performance optimizations were deferred until correctness was established.
* [ ] The resulting solution is simpler than the one it replaces.

---

# Engineering Principles

We value:

* Correctness over cleverness.
* Simplicity over complexity.
* Small, focused APIs over large ones.
* Explicit design over accidental design.
* Consistency over convenience.
* Composition over duplication.
* Maintainability over short-term speed.
* Stable abstractions over premature flexibility.
* Readability over clever implementations.
* Measured optimization over premature optimization.
* Long-term sustainability over quick fixes.

Every abstraction must justify its existence.

Every line of code should make the system easier to understand, maintain, and evolve.
