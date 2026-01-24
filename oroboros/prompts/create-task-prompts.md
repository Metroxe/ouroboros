You are a senior software engineer preparing implementation prompts for a feature's task groups. Your goal is to generate individual prompt files that can be executed sequentially to implement a feature, along with progress tracking.

This prompt is fully autonomous and requires no user interaction. Execute each phase in sequence, completing all steps before moving to the next phase.

**Required Input:** This prompt must be invoked with a path to a feature folder (e.g., `oroboros/epics/2025-01-19-user-authentication/features/01-create-user-model`). The feature must have a `tasks.md` file created by the `create-tasks.md` prompt.

# PHASE 1: Context Gathering

## Step 1: Validate Input

Confirm you have received a feature path. The path should point to a feature folder containing `tasks.md`.

**If no feature path was provided:** Stop execution and output:
```
Error: No feature path provided.

Usage: Invoke this prompt with a path to a feature folder.
Example: oroboros/epics/2025-01-19-user-authentication/features/01-create-user-model

The feature folder must contain a tasks.md file created by the create-tasks.md prompt.
```

**If the feature path is valid:** Continue to Step 2.

## Step 2: Extract Path Information

From the feature path, derive:

1. **Feature name**: The folder name (e.g., `01-create-user-model`)
2. **Epic path**: The parent of `features/` directory (e.g., `oroboros/epics/2025-01-19-user-authentication`)
3. **Prompts directory**: `{feature-path}/prompts/`

## Step 3: Read and Parse tasks.md

Read `{feature-path}/tasks.md` and extract all task groups.

Task groups are identified by headings matching this pattern:
```
### Task Group N: {Task Group Name}
```

For each task group, capture:
- **Number**: The task group number (N)
- **Name**: The task group name in kebab-case (e.g., "Testing Plan" becomes "testing-plan")
- **Full content**: Everything from the heading until the next task group heading (or end of Task Groups section)

# PHASE 2: Generate Files

## Step 1: Create Prompts Directory

Create the directory: `{feature-path}/prompts/`

## Step 2: Create development-notes.md

Create `{feature-path}/development-notes.md` with the following initial content:

```markdown
# Development Notes: {Feature Name}

This file is a shared scratchpad for task implementers. Each task group should add notes here that would be useful for later task groups.

---

<!-- Add notes below as you implement each task group -->
```

## Step 3: Create progress.yml

Create `{feature-path}/prompts/progress.yml` with the following structure:

```yaml
task_groups:
  - name: {task-group-1-name-kebab-case}
    completed: false
  - name: {task-group-2-name-kebab-case}
    completed: false
  # ... repeat for each task group
```

## Step 4: Generate Prompt Files

For each task group extracted in Phase 1, create a prompt file at:
`{feature-path}/prompts/{N}-{task-group-name-kebab-case}.md`

Use the following template for each prompt file:

---

```markdown
You are implementing task group {N} for feature: {feature-name}

# Task Group {N}: {Task Group Name}

## Context Files to Read

Before implementing, read these files to understand the context:

1. `{feature-path}/prd.md` - Feature requirements and acceptance criteria
2. `{feature-path}/tasks.md` - Full task list showing what came before and after this task group
3. `{epic-path}/requirements.md` - Epic context and scope
4. `{epic-path}/features-index.yml` - Where this feature fits in the epic's sequence
5. `oroboros/reference/tech-stack.md` - Technical patterns and conventions
6. `oroboros/reference/gotchas.md` - Known pitfalls to avoid
7. `{feature-path}/development-notes.md` - Notes from previous task groups

## Task Group to Implement

{Full task group content copied from tasks.md, including the heading and all sub-tasks}

## Implementation Instructions

1. Read all context files listed above
2. Analyze existing codebase patterns relevant to this task group
3. Implement all tasks in this task group sequentially
4. Follow the patterns established in tech-stack.md
5. Avoid issues documented in gotchas.md
6. Run verification steps as specified in the task group

## After Implementation

### 1. Update tasks.md

Mark completed tasks in `{feature-path}/tasks.md`:
- Change `- [ ]` to `- [x]` for each completed task

### 2. Update progress.yml

In `{feature-path}/prompts/progress.yml`, set this task group's `completed` to `true`:
```yaml
  - name: {task-group-name-kebab-case}
    completed: true
```

### 3. Add to development-notes.md

Append a section to `{feature-path}/development-notes.md`:

```markdown
## From Task Group {N} ({Task Group Name})

- [Document key decisions made during implementation]
- [Note any deviations from the original PRD and why]
- [List file paths, function names, or patterns you created that later task groups should know about]
- [Include any context that would help the next task group]
```

### 4. Consider gotchas.md (Rarely)

**Most task groups should NOT add to gotchas.md.** Only add if you encountered something:
- Unintuitive that affects the project as a whole
- That would cause bugs if future developers don't know about it
- That isn't obvious from reading the code or library docs

**Examples of good gotchas:**
- "PostgreSQL JSONB columns require `column->>'key'` syntax, not dot notation - queries will silently return null otherwise"
- "The auth middleware must be registered AFTER CORS middleware or preflight requests fail silently with 401"
- "API returns 200 with `{success: false}` for validation errors - always check response.success, not HTTP status"
- "Environment variables for client-side code must be prefixed with NEXT_PUBLIC_ or they won't be bundled"
- "The legacy users table uses soft deletes - always include `deleted_at IS NULL` or you'll query deleted records"
- "Date fields from the API are ISO strings, not Date objects - parse before comparing"

**Do NOT add:**
- Feature-specific implementation details (put in development-notes.md instead)
- Things that belong in tech-stack.md (standard patterns, not gotchas)
- Temporary workarounds that will be fixed soon
- Obvious behavior documented in library docs

If you do add a gotcha, append it to `oroboros/reference/gotchas.md` with a brief, actionable description.
```

---

**For the first task group of the first feature only** (i.e., feature `01-*` and task group `1-*`), prepend this section before "## Implementation Instructions":

````markdown
## Before Implementation

### Update epic-index.md to In Progress

This is the first task of the first feature, which means implementation is beginning. Update `oroboros/reference/epic-index.md` to move this epic from "Planning" to "In Progress":

1. Find the epic entry under `### Planning`
2. Remove it from that section
3. Add it under `### In Progress`

Example format:
```markdown
### In Progress

- **{epic-name}** (started {YYYY-MM-DD}) - {brief description}
  - Path: `{epic-path}`
```

After updating epic-index.md, proceed with the implementation instructions below.
````

---

**For the final task group only**, append these additional steps to the "After Implementation" section:

````markdown
### 5. Update features-index.yml for Later Features

Update `{epic-path}/features-index.yml` with implementation notes so later features know what was actually built:

Find this feature's entry and add the `implementation_notes` field:

```yaml
  - number: "{NN}"
    name: {feature-name}
    path: features/{NN}-{feature-name}/prd.md
    description: {description}
    completed: true  # <- Change from false to true
    depends_on: [...]
    provides: [...]
    implementation_notes:
      shared_components_created:
        - path: {file-path-you-created}
          description: {What it does and how to use it}
      patterns_established:
        - "{Any patterns or conventions you established that later features should follow}"
      gotchas:
        - "{Any non-obvious constraints or issues later features should know about}"
```

**Important:** This is different from `development-notes.md`:
- `development-notes.md` = communication between task groups *within this feature*
- `implementation_notes` in features-index.yml = communication to *later features* in this epic

If this feature created shared components or established patterns that later features will use, document them here so those features can integrate properly.

### 6. Update epic-index.md (If Epic Complete)

Check `{epic-path}/features-index.yml` to see if ALL features in this epic now have `completed: true`.

**If all features are complete:**

Update `oroboros/reference/epic-index.md` to move this epic from "In Progress" to "Complete":

1. Find the epic entry under `### In Progress`
2. Remove it from that section
3. Add it under `### Complete` with the completion date

Example format for the completed epic entry:
```markdown
### Complete

- **{epic-name}** (completed {YYYY-MM-DD}) - {brief description}
  - Path: `{epic-path}`
```

**If NOT all features are complete:** Skip this step - the epic remains "In Progress".
````

---

# PHASE 3: Output Summary

After creating all files, output the following summary:

```
Task prompts generated for: {feature-name}

Created files:
- {feature-path}/development-notes.md
- {feature-path}/prompts/progress.yml
- {feature-path}/prompts/1-{task-group-1-name}.md
- {feature-path}/prompts/2-{task-group-2-name}.md
- ... (list all prompt files)

Total task groups: {N}

To implement this feature:
1. Run each prompt in order (1, 2, 3, ...)
2. Each prompt will update progress.yml when complete
3. To resume after stopping, check progress.yml for the first task group with `completed: false`

Progress tracking: {feature-path}/prompts/progress.yml
```