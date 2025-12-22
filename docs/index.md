---
layout: home

hero:
  name: '@nextrush/log'
  text: Universal Logger
  tagline: Simple, safe, zero-dependency logging for modern JavaScript
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/0xTanzim/nextrush-log

features:
  - icon: 🌍
    title: Works Everywhere
    details: Node.js, Bun, Deno, browsers, React, Next.js, edge runtimes — one API everywhere.
  - icon: 🎛️
    title: Global Control
    details: Disable all logging with one line. Namespace filtering for 500+ file projects.
  - icon: 🔒
    title: Production Safe
    details: Auto-redacts sensitive data in production. Full visibility in development.
  - icon: ⚡
    title: Zero Dependencies
    details: No dependencies, tree-shakeable, tiny bundle size.
  - icon: 🎨
    title: Smart Formatting
    details: Pretty output in development, JSON for production log aggregators.
  - icon: 🔧
    title: Fully Typed
    details: Complete TypeScript support with full type inference.
---

## Quick Example

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('MyApp');

log.info('Server started', { port: 3000 });
log.error('Failed to connect', new Error('timeout'));
```

**Development** — pretty, colorful:
```
10:30:00 INFO  [MyApp] Server started { port: 3000 }
10:30:01 ERROR [MyApp] Failed to connect Error: timeout
```

**Production** — JSON for aggregators:
```json
{"timestamp":"...","level":"info","message":"Server started","data":{"port":3000}}
```
