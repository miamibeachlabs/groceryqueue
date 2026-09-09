# AGENTS.md

Write code with taste. Optimize this project for me, the human reader.

Human comprehensibility, conceptual integrity, and aesthetic quality take
priority over minimizing diffs, preserving weak existing designs, avoiding
small useful libraries, or completing an implementation quickly. Working code
that is unpleasant to read is unfinished.

Haskell is the standard of architectural taste, even though this project uses
TypeScript. Write natural TypeScript rather than imitating Haskell syntax.

## Never use Node

Never use Node.js or npm in this project. Do not introduce them indirectly
through scaffolding, scripts, development servers, build systems, test runners,
package-manager commands, or deployment configuration.

This is an architectural constraint, not a casual tool preference. Node is a
legacy patchwork with too much incidental machinery, historical compatibility,
and inelegant convention. Those qualities conflict with this project's goals:
small conceptual surface area, coherent design, readable configuration, and
tools that treat TypeScript as a natural default.

Use Bun for TypeScript execution, dependencies, scripts, tests, development,
and builds. Consider Deno only when it produces an equally direct and elegant
solution. Do not add Node compatibility machinery merely because a library or
tutorial assumes it. Choose a different library or approach.

Only use Node if I explicitly reverse this rule for a specific task.

## What simple means

Simple means fewer concepts, fewer incidental details, and less code for the
reader to understand. It does not automatically mean fewer dependencies or
using primitive platform APIs.

Prefer:

- simple, declarative code
- small functions and focused modules
- explicit data flow
- reusable abstractions
- pure logic separated from effects
- immutable values where practical
- the shortest solution that remains clear
- cleanly modeled data
- raw external data kept separate from derived data

Avoid:

- duplicated logic
- unnecessary complexity
- deep nesting
- boilerplate
- premature abstraction
- hidden mutable global state
- large functions that mix concerns
- ceremonial factories, adapters, services, or dependency injection
- heavy frameworks when direct code is clearer
- primitive platform code when a small library makes the program clearer
- enterprise-style sludge

## Design from the domain outward

Before implementing a non-trivial feature:

1. Identify the essential domain concepts.
2. Define their types and public behavior.
3. Separate reusable abstractions from application-specific policy.
4. Hide representations and implementation details.
5. Put effects, persistence, frameworks, and browser machinery at the edges.
6. Build the interface around the resulting model.

The conceptual structure of the program should be visible from the directory
layout, module boundaries, types, names, and public APIs.

## Pristine core, practical shell

Hold reusable data structures and domain models to the highest standard. They
should be correct, succinct, explicit, composable, easy to reason about, and
independent of UI frameworks, storage, browsers, and application details.
Make invalid states impossible or difficult to represent.

Interface and integration code may contain necessary framework or platform
machinery. Some local ugliness is acceptable when it is inherent in making the
interface work, but keep it orderly and do not let it contaminate the core.

Dependencies point inward:

```text
interface and infrastructure
          |
          v
     domain model
          |
          v
 reusable data structures
```

Dependencies must not point upward.

## Abstractions and public APIs

State an abstraction before choosing its representation.

For reusable concepts:

- define a small public interface
- keep the representation private
- separate policy from mechanism
- export only the deliberate public API
- group operations that form one concept
- make invalid construction impossible or difficult
- name implementations after their actual representation or strategy

For example, define `PriorityQueue<T>` by its behavior and provide
`SortedPriorityQueue<T>` or `BinaryHeap<T>` as implementations. Grocery
ordering belongs in the grocery domain, not in the generic queue.

Do not expose a raw object representation and call it an abstraction. Do not
make every internal type and helper an export. A reader should understand a
public API without first reading its implementation.

## TypeScript style

Prefer:

- discriminated unions
- readonly values
- exhaustive decisions
- explicit inputs and outputs
- small pure functions
- focused modules
- transformations over mutation
- domain names over technical names
- one obvious public entry point for a coherent abstraction

Use classes when they clearly express an abstract data type with private
representation. Use functions when they express transformations more clearly.
Do not force either style everywhere.

Avoid:

- flat bags of unrelated exports
- public representation fields
- mutable module-level state
- large components mixing policy, effects, state, and rendering
- generic helper layers with no conceptual meaning
- repeated validation or business rules in interface code

## Libraries and runtime

Do not equate simplicity with avoiding libraries. A small, well-designed
library is desirable when it reduces application code, clarifies intent, and
has a low operational cost. Prefer a focused framework such as Preact when it
makes interface code shorter and easier to read. Every dependency must earn
its place through a clear reduction in conceptual or implementation complexity.

Use Bun-native or runtime-independent dependencies. Avoid compatibility
machinery whose only purpose is supporting legacy Node workflows.

Keep the deployed application compatible with Cloudflare's free static hosting
unless I explicitly approve a different deployment architecture.

## Rewrite policy

Do not preserve ugly or confused code merely to minimize a diff. When an
implementation has the wrong conceptual structure, step back and redesign it
from first principles. Preserve required behavior and user data, not accidental
architecture.

Before a substantial rewrite:

1. Describe the intended concepts and dependency direction.
2. Identify the public abstractions.
3. Decide which details must remain private.
4. Account for compatibility with persisted data.
5. Implement the clean design.

After multiple revisions, reassess the whole structure instead of adding
another corrective layer.

## Working style

Think before coding. For non-trivial changes, explain the design before
implementing it. Do not jump into code while I am exploring alternatives. If a
solution feels complicated, search for a simpler structure. Refactor toward
fewer moving parts, clearer boundaries, and more obvious intent.

## Readability review

Before calling a change complete, read the code as a new human reader would.
Check that:

- the reading order is obvious
- each module represents one coherent idea
- public APIs are understandable without their implementations
- reusable code contains no application-specific assumptions
- domain rules appear in one authoritative place
- effects are visible at the boundaries
- names reveal the model
- unnecessary exports, layers, and files have been removed
- the final result is worth studying, not merely operational

If the implementation works but the architecture is unpleasant to read, the
work is not complete.
