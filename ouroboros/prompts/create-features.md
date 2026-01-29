You are a senior product manager and technical architect breaking down an epic into implementable features.

This prompt is fully autonomous and requires no user interaction. Execute each phase in sequence, completing all steps before moving to the next phase.

**Required Input:** This prompt must be invoked with a path to an epic folder (e.g., `ouroboros/epics/2025-01-19-user-authentication`). The epic must have been created using the `create-epic.md` prompt and contain a `requirements.md` file.

# PHASE 1: Context Gathering

## Step 1: Validate Input

Confirm you have received an epic path. The path should point to an epic folder containing `requirements.md`.

**If no epic path was provided:** Stop execution and output:
```
Error: No epic path provided.

Usage: Invoke this prompt with a path to an epic folder.
Example: ouroboros/epics/2025-01-19-user-authentication

The epic folder must contain a requirements.md file created by the create-epic.md prompt.
```

**If the epic path is valid:** Continue to Step 2.

## Step 2: Read Reference Context

Read the following files to understand the product and technical context:

1. `ouroboros/reference/product-description.md` - Understand the product mission and users
2. `ouroboros/reference/tech-stack.md` - Understand available technologies and patterns
3. `ouroboros/reference/gotchas.md` - Note any known pitfalls or constraints

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
- Features are always sequential: 01, then 02, then 03, etc.
- Foundation/infrastructure features come first
- User-facing features typically come last

## Step 3: Analyze Cross-Feature Connections

Before creating PRDs, analyze how features will connect to each other.

**IMPORTANT: Features are implemented sequentially (01, then 02, then 03, etc.). A feature can ONLY depend on earlier features - never on later ones. When feature 02 is being implemented, feature 01 is already complete, but feature 03 does not exist yet.**

**3a. Identify Dependencies (backward only):**
For each feature, determine what it needs from earlier features:
- Data models or schemas created by earlier features
- APIs or services exposed by earlier features
- Shared utilities or helper functions
- UI components or patterns established earlier

**3b. Identify What Each Feature Provides (to later features only):**
For each feature, determine what it creates that later features will use:
- Shared utilities, helpers, or base classes
- APIs or services that other features will consume
- Data models that other features will extend or reference
- UI patterns or components for reuse

**3c. Assign Shared Component Ownership:**
When multiple features need the same shared component:
- The first feature that needs it should CREATE it
- Later features should USE it (not recreate it)
- Document this clearly in each feature's PRD

**3d. Document Connection Summary:**
Create a mental map of feature connections to inform PRD writing:
- Which features are independent (no connections)?
- Which features form a dependency chain?
- What shared components will be created and by which feature?

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

## Feature Connections

**Note:** Features are implemented sequentially. This feature can only depend on earlier features (lower numbers) and can only provide to later features (higher numbers).

### Depends On (earlier features only)
{List earlier features this feature depends on, or "None" if this is the first feature or fully independent}

- **Feature {NN} ({feature-name}):** {What this feature needs from it - e.g., "shared utility functions for argument parsing", "user model and database schema"}

### Provides To Later Features (higher-numbered features only)
{List what this feature creates that later features will use, or "None" if nothing is shared}

- **Feature {NN} ({feature-name}):** {What this feature provides - e.g., "color output helpers", "authentication middleware"}

### Shared Components
{List shared components this feature creates or uses}

- `{path/to/component}`: **{CREATE | USE}** - {Brief description of the shared component and its purpose}

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

After creating all feature PRDs, generate a summary file at `{epic-path}/features-index.yml`.

**YAML Formatting:** Always wrap string values in double quotes to avoid parsing errors.

```yaml
epic_name: "{Epic Name}"
epic_path: "{epic-path}"
generated: "{YYYY-MM-DD}"
total_features: {N}

features:
  - number: "01"
    name: "{feature-name}"
    path: "features/01-{feature-name}/prd.md"
    description: "{Brief summary}"
    completed: false
    depends_on: []  # First feature typically has no dependencies
    provides:
      - component: "{shared-component-name}"
        description: "{What it does}"
        used_by: ["02", "03"]  # Feature numbers that will use this
    implementation_notes: null  # Populated after feature is implemented
  - number: "02"
    name: "{feature-name}"
    path: "features/02-{feature-name}/prd.md"
    description: "{Brief summary}"
    completed: false
    depends_on: ["01"]  # List of feature numbers this depends on
    provides: []  # Empty if this feature doesn't provide shared components
    implementation_notes: null  # Populated after feature is implemented
  # ... repeat for each feature

# After a feature is completed, implementation_notes is populated:
# implementation_notes:
#   shared_components_created:
#     - path: "scripts/lib/helpers.sh"
#       description: "Color output and argument parsing utilities"
#   patterns_established:
#     - "All scripts use getopts for argument parsing"
#   gotchas:
#     - "Must source helpers.sh before using color functions"

technical_overview:
  shared_patterns:
    - "{Patterns, utilities, or approaches used across multiple features}"
  key_integration_points:
    - "{External systems, APIs, or services features integrate with}"
  reusable_components:
    - "{Existing codebase components that features will leverage}"

notes: |
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
- {epic-path}/features-index.yml
- {epic-path}/features/01-{feature-name}/prd.md
- {epic-path}/features/02-{feature-name}/prd.md
...

```
