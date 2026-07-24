@AGENTS.md
@PRODUCT.md

# Party-up Development Constitution

This document defines the permanent engineering principles for Party-up.
These principles take precedence over implementation convenience.
When multiple implementations are possible, follow this document before making technical decisions.

## 1. Product Philosophy

Party-up is not a game matching service.
Party-up is a platform for finding people you want to play with again.

People are the product. Games are the content.

Every implementation should reinforce this philosophy.
When choosing between feature richness and user trust,
always choose trust.

## 2. Product Vision

Party-up exists to make multiplayer gaming safer, friendlier, and more enjoyable.

The objective is not to maximize engagement.
The objective is to maximize meaningful experiences.

Every feature should encourage at least one of the following behaviors:

- Meet new people.
- Play respectfully.
- Build long-term gaming relationships.
- Discover different games.
- Create memorable experiences.

If a feature does not improve trust, relationships, or user experience,
consider removing it instead of building it.

## 3. Core Product Principles

Always prioritize:

1. People over games.
2. Trust over features.
3. Long-term maintainability over short-term convenience.
4. Simplicity over cleverness.
5. Consistency over speed.
6. Readability over optimization.
7. Product quality over feature quantity.

Prefer structured system selections (e.g., official game lists, predefined tags) over free-text input whenever possible.
Free-text should complement structured data, not replace it.
Structured data improves consistency, searchability, trust, and future scalability.

Do not add complexity unless it solves a real user problem.

## 4. User Behavior First

Do not ask:
"What feature can we build?"

Instead ask:
"What user behavior are we encouraging?"

Features exist to encourage good behavior.
Behavior does not exist to justify features.

## 5. Trust & Reputation

Reputation is not popularity.
Reputation is not skill.

Reputation answers one question:
"Would you play with this person again?"

Never expose:

- Reputation calculation algorithm
- Internal trust score
- Reputation weighting logic
- Abuse detection rules
- Anti-cheat thresholds

Only expose the final reputation tier.

Trust is earned through consistent behavior.

## 6. Experience Design

Do NOT implement:

- Attendance rewards
- Daily login rewards
- XP systems
- Artificial engagement loops
- Infinite notification loops
- Endless progression systems

Good experiences are the reward.
Never manipulate users into staying.
Build products users genuinely want to return to.

## 7. Privacy

Privacy is part of the product.

Collect the minimum amount of personal information.
Never collect information without a clear purpose.
Never expose unnecessary user information.
Never expose user gender.
Prefer anonymity whenever possible.

## 8. Security

Security is never optional.

Assume every client request is untrusted.
Never trust client-side validation.

Always validate the following on the server:

- Authentication
- Authorization
- Resource ownership

Never rely on hidden UI for access control.
Every privileged action must be verified server-side.

Never expose:

- Service Role Keys
- Environment Secrets
- Internal APIs
- Database Credentials

Always sanitize and validate user input.
Escape user-generated content before rendering.
Use Row Level Security (RLS) whenever possible.
Prefer secure defaults over convenient defaults.
Never expose internal implementation details through error messages.

## 9. Architecture

Party-up follows a Domain-Oriented Architecture.

Every feature belongs to exactly one domain.
Avoid creating generic folders.

Move code into Shared only when:

- it is domain-independent;
- it contains no business logic; and
- it is genuinely reused across multiple domains.

Every file should have one clear owner.
If ownership is unclear,
STOP.
Ask before refactoring.

## 10. App Structure

The App Router is responsible only for:

- Routing
- Layout composition
- Page composition

Business logic belongs inside Domains.
Avoid placing business logic inside pages.

Prefer path aliases.
Avoid deep relative imports.

## 11. Code Quality

Write code that is:

- Readable
- Predictable
- Maintainable
- Testable

Prefer explicit code over clever code.
Avoid premature abstraction.
Code is written for humans first.

## 12. Refactoring

Refactoring should happen in small, reviewable Sprints.
Each Sprint should have exactly one responsibility.

Examples:

- Move files
- Extract components
- Introduce services
- Introduce repositories
- Introduce shared components

Avoid combining multiple architectural changes into one Sprint.
Prefer small, reversible changes.
Refactoring must not change user-facing behavior unless explicitly requested.

## 13. Development Workflow

Before implementing any feature:

1. Understand the user problem.
2. Verify that it aligns with Party-up philosophy.
3. Design the simplest viable solution.
4. Implement.
5. Validate.
6. Commit.

Never implement first and justify later.

## 14. Validation

Every architectural change must pass:

- TypeScript
- ESLint
- Build
- Existing behavior verification

Behavior preservation is more important than code movement.

## 15. Git Workflow

Every Sprint should end with:

- Validation
- Commit

Do not push unless explicitly requested.
One commit should represent one logical change.

## 16. Decision Rules

When multiple solutions are technically valid,
choose the one that:

1. Preserves user trust.
2. Keeps the architecture simpler.
3. Is easier to maintain.
4. Encourages healthier player behavior.
5. Is easier for another developer to understand.

If two solutions are equivalent,
choose the simpler one.

## 17. AI Collaboration Rules

If requirements are ambiguous,
ask before implementing.

Do not invent product behavior.
Do not silently change architecture.
Do not silently change database schemas.
Do not silently change API contracts.

Explain trade-offs when multiple approaches exist.

Be opinionated,
but remain aligned with the Party-up philosophy.

The objective is not to generate more code.
The objective is to build a better product.
