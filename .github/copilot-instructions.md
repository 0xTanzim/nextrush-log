---
description: "Instructions to help GitHub Copilot generate accurate, consistent, and production-grade code for the @nextrush/log project."
applyTo: "**"
---

# @nextrush/log – GitHub Copilot Instructions

You are working inside **@nextrush/log**, a universal, production-grade logging library designed for modern JavaScript runtimes.

This project values **correctness, clarity, performance, and long-term maintainability** over shortcuts.

---

## 1. Project Purpose

@nextrush/log is a **zero-dependency**, **runtime-agnostic** logger that works across:

- Node.js
- Bun
- Deno
- Edge runtimes (Vercel Edge, Cloudflare Workers)
- Browsers
- React Server Components

The logger is designed to be:
- Framework-agnostic
- Tree-shakeable
- Safe by default (redaction, serialization guards)
- Suitable for enterprise backends and SaaS platforms

---

## 2. Core Design Principles

When generating code, always follow these principles:

### ✅ Separation of Concerns
- Core logging logic must not depend on runtime, console, or environment APIs
- Runtime detection, formatting, serialization, and transports must be isolated
- Avoid “god classes” or multi-responsibility functions

### ✅ Predictability
- Prefer explicit behavior over implicit magic
- Avoid hidden side effects
- Favor immutable data structures where possible

### ✅ Production Safety
- Never throw from logging code
- Fail silently and safely
- Avoid blocking I/O in the critical path
- Assume logs may run in serverless or edge environments

---

## 3. Architecture Expectations

Follow the layered architecture:

- **core/** – pure logic (levels, pipeline, filtering)
- **serializer/** – safe serialization, redaction, circular handling
- **formatter/** – pretty, JSON, browser formatting
- **transport/** – console, batch, HTTP, file, etc.
- **context/** – correlation ID and async context handling
- **runtime/** – environment detection and capabilities
- **plugins/** – optional extensions via hooks

Do not mix layers.

---

## 4. Logging Model

- Logs flow through a **pipeline**, not directly to transports
- Filtering (level, sampling) happens before formatting
- Formatting happens before transport dispatch
- Transports are fire-and-forget and must never break logging

Always assume:
- Transports may be async
- Transports may fail
- Multiple transports may be active

---

## 5. TypeScript Guidelines

- Use strict TypeScript types
- Avoid `any`
- Prefer `unknown` with proper narrowing
- Export explicit public types
- Keep internal types private unless required

Do not weaken types to satisfy Copilot suggestions.

---

## 6. Error Handling Rules

- Logging must never crash the application
- Catch all transport and formatter errors
- Errors inside the logger should be swallowed or reported safely
- Never recursively log errors caused by the logger itself

---

## 7. Serialization Rules

When serializing data:

- Always protect against circular references
- Enforce maximum depth and size limits
- Redact sensitive keys (`password`, `token`, `authorization`, etc.)
- Handle special types (Error, Map, Set, ArrayBuffer, Promise)
- Never mutate user-provided objects

---

## 8. Performance Constraints

- Avoid allocations in hot paths
- Prefer lazy evaluation where possible
- Do not use JSON.stringify unless required
- Avoid heavy stack inspection unless explicitly enabled

Logging must remain cheap even when disabled.

---

## 9. API Design Philosophy

Public APIs should be:

- Small
- Composable
- Discoverable
- Backward-compatible

Avoid breaking changes unless absolutely necessary.

Favor:
- `createLogger()`
- `logger.child()`
- `logger.withCorrelationId()`
- Plugin-based extensibility

---

## 10. Testing Expectations

When generating tests:

- Test behavior, not implementation details
- Cover edge cases (circular data, large objects, errors)
- Ensure logging never throws
- Validate redaction and serialization correctness

---

## 11. Style & Readability

- Use clear, descriptive names
- Prefer small functions
- Avoid clever tricks
- Write code as if it will be read by another engineer in 6 months

Clarity beats brevity.

---

## 12. What to Avoid

❌ No framework-specific code
❌ No hidden globals
❌ No environment-specific assumptions
❌ No side effects at import time
❌ No logging inside core logger internals

---

## Final Reminder

This is an **infrastructure-level library**.

Every change should be:
- Safe
- Intentional
- Boring in the best way

Optimize for correctness and trust, not cleverness.
