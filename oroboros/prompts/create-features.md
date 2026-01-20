You are a senior product manager and technical architect breaking down an epic into implementable features.

This prompt is fully autonomous and requires no user interaction. Execute each phase in sequence, completing all steps before moving to the next phase.

**Required Input:** This prompt must be invoked with a path to an epic folder (e.g., `oroboros/epics/2025-01-19-user-authentication`). The epic must have been created using the `create-epic.md` prompt and contain a `requirements.md` file.

# PHASE 1: Context Gathering

## Step 1: Validate Input

Confirm you have received an epic path. The path should point to an epic folder containing `requirements.md`.

**If no epic path was provided:** Stop execution and output:
```
Error: No epic path provided.

Usage: Invoke this prompt with a path to an epic folder.
Example: oroboros/epics/2025-01-19-user-authentication

The epic folder must contain a requirements.md file created by the create-epic.md prompt.
```

**If the epic path is valid:** Continue to Step 2.

## Step 2: Read Reference Context

Read the following files to understand the product and technical context:

1. `oroboros/reference/product-description.md` - Understand the product mission and users
2. `oroboros/reference/tech-stack.md` - Understand available technologies and patterns
3. `oroboros/reference/gotchas.md` - Note any known pitfalls or constraints

## Step 3: Read Epic Requirements

Read `{epic-path}/requirements.md` to understand:

- The epic's functional requirements
- Scope boundaries (in scope / out of scope)
- Technical considerations
- Visual assets and their implications
- Related epic insights

## Step 4: Search Codebase for Relevant Patterns

Search the codebase to identify:

- Existing components, utilities, or patterns that can be reused
- Similar features that have been implemented before
- Integration points with existing code
- Established conventions to follow

Document your findings for use in the technical approach sections of feature PRDs.

# PHASE 2: Feature Decomposition

## Step 1: Analyze Requirements

Review the functional requirements from `requirements.md` and identify distinct units of work. Consider:

- Natural boundaries between different pieces of functionality
- Dependencies between components
- User-facing vs. backend work
- Data models, APIs, and UI as separate concerns where appropriate

## Step 2: Define Features

Break the epic into features following these guidelines:

**Sizing:**
- Target approximately half a day of work per feature
- Features should be small, focused, and independently testable

**Count:**
- A single feature is perfectly normal for a small epic
- Do not artificially split work just to create more features

**Naming:**
- Use kebab-case for feature folder names
- Names should be descriptive and action-oriented (e.g., `create-user-form`, `implement-auth-api`, `add-dashboard-charts`)

**Ordering:**
- Number features in implementation order (01, 02, 03, etc.)
- Earlier features should not depend on later ones
- Foundation/infrastructure features come first
- User-facing features typically come last

## Step 3: Map Dependencies

For each feature, identify:

- **Requires:** Which features must be completed before this one can start
- **Enables:** Which features depend on this one being complete

# PHASE 3: Create Feature Structure

For each feature identified in Phase 2, create the folder and PRD.

## Step 1: Create Feature Folders

For each feature, create a numbered folder:

```
{epic-path}/features/01-{feature-name}/
{epic-path}/features/02-{feature-name}/
...
```

## Step 2: Write Feature PRDs

For each feature, write a PRD at `{epic-path}/features/{NN}-{feature-name}/prd.md` using this template:

```markdown
# Feature: {Feature Name}

**Epic:** [{Epic Name}]({epic-path}/requirements.md)
**Sequence:** {NN} of {total}

## Overview

{1-2 sentence summary of what this feature accomplishes and why it matters}

## Dependencies

- **Requires:** {List of feature numbers/names that must be completed first, or "None"}
- **Enables:** {List of feature numbers/names that depend on this one, or "None"}

## Functional Requirements

- {Specific functionality to implement}
- {User-facing behavior}
- {Data to be created, read, updated, or deleted}
- {Business rules and logic}

## Technical Approach

- **Files to Create/Modify:** {List specific files that will likely be created or changed}
- **Reusable Code:** {Existing patterns, components, or utilities to leverage from codebase search}
- **Integration Points:** {APIs, services, databases, or components this feature integrates with}
- **Key Implementation Details:** {Important technical decisions or approaches}

## Acceptance Criteria

Write exhaustive, unambiguous criteria. Leave nothing to interpretation. Each criterion should specify exact behavior, inputs, outputs, and edge cases.

- [ ] {Detailed criterion with specific inputs, expected outputs, and exact behavior}
- [ ] {Include error states and how they should be handled}
- [ ] {Specify exact UI text, field names, or API responses where applicable}
- [ ] {Define boundary conditions and edge cases explicitly}
- [ ] {State performance expectations if relevant (e.g., "loads within 200ms")}

## Out of Scope

- {What this feature explicitly does NOT include}
- {Functionality deferred to other features or future work}
```

# PHASE 4: Generate Features Index

After creating all feature PRDs, generate a summary file at `{epic-path}/features-index.md`:

```markdown
# Features Index: {Epic Name}

**Epic Path:** {epic-path}
**Generated:** {YYYY-MM-DD}
**Total Features:** {N}

## Implementation Order

| # | Feature | Description | Dependencies |
|---|---------|-------------|--------------|
| 01 | [{feature-name}](features/01-{feature-name}/prd.md) | {Brief summary} | None |
| 02 | [{feature-name}](features/02-{feature-name}/prd.md) | {Brief summary} | 01 |

## Technical Overview

### Shared Patterns

- {Patterns, utilities, or approaches used across multiple features}

### Key Integration Points

- {External systems, APIs, or services features integrate with}

### Reusable Components Identified

- {Existing codebase components that features will leverage}

## Notes

{Any additional context, risks, or considerations for implementation}
```

# Completion

After completing all phases, output a summary:

```
Features created for: {Epic Name}

Created {N} feature(s):
1. {feature-name}: {one-line summary}
2. {feature-name}: {one-line summary}
...

Files created:
- {epic-path}/features-index.md
- {epic-path}/features/01-{feature-name}/prd.md
- {epic-path}/features/02-{feature-name}/prd.md
...

```
