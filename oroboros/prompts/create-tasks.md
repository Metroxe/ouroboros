You are a senior software engineer creating a detailed, actionable task list for implementing a feature. Your goal is to produce step-by-step instructions that another AI agent (or developer) can follow to implement the feature completely and correctly.

This prompt is fully autonomous and requires no user interaction. Execute each phase in sequence, completing all steps before moving to the next phase.

**Required Input:** This prompt must be invoked with a path to a feature folder (e.g., `oroboros/epics/2025-01-19-user-authentication/features/01-create-user-model`). The feature must have been created using the `create-features.md` prompt and contain a `prd.md` file.

# PHASE 1: Context Gathering

## Step 1: Validate Input

Confirm you have received a feature path. The path should point to a feature folder containing `prd.md`.

**If no feature path was provided:** Stop execution and output:
```
Error: No feature path provided.

Usage: Invoke this prompt with a path to a feature folder.
Example: oroboros/epics/2025-01-19-user-authentication/features/01-create-user-model

The feature folder must contain a prd.md file created by the create-features.md prompt.
```

**If the feature path is valid:** Continue to Step 2.

## Step 2: Read Reference Context

Read the following files to understand the product and technical context:

1. `oroboros/reference/product-description.md` - Understand the product mission and users
2. `oroboros/reference/tech-stack.md` - Understand available technologies, patterns, AND testing conventions
3. `oroboros/reference/gotchas.md` - Note any known pitfalls or constraints to avoid

## Step 3: Read Epic Context

Determine the epic path from the feature path (parent of `features/` directory).

Read the following files:

1. `{epic-path}/requirements.md` - Full epic requirements and scope
2. `{epic-path}/features-index.md` - Understand where this feature fits in the sequence and its dependencies

## Step 4: Read Feature Context

Read `{feature-path}/prd.md` to understand:

- The feature's functional requirements
- Dependencies on other features
- Files to create/modify (as listed in Technical Approach)
- Acceptance criteria to satisfy
- What is explicitly out of scope

## Step 5: Full Codebase Search

Search the codebase comprehensively to gather implementation context:

**5a. Search for Similar Implementations:**
- Use semantic search to find features similar to what you're building
- Look for established patterns, naming conventions, and code structure
- Identify reusable utilities, helpers, or base classes

**5b. Search for Integration Points:**
- Find files that will need to import/use the new code
- Identify APIs, services, or components this feature integrates with
- Locate configuration files that may need updates

**5c. Extract Patterns from Existing Code:**
- For each type of file you'll create, find an existing example
- Document the patterns used: imports, exports, error handling, logging
- Note naming conventions for files, functions, classes, and variables

## Step 6: Build Dependency Map

Construct a dependency map of all files involved. Execute these steps in order:

**6a. Identify Entry Points:**
From the PRD's "Files to Create/Modify" section, list all files explicitly mentioned as starting points.

**6b. Trace Import Chains:**
For each file that will be modified:
- Read the file and extract all imports/requires
- For each import, determine if that file will also need changes
- Recursively trace until you reach stable boundaries (files that won't change)

**6c. Identify Dependents (Reverse Dependencies):**
Search the codebase for files that import/require the files being modified:
- Use grep/search for import statements referencing the target files
- These files may need updates if interfaces/exports change

**6d. Categorize Each File:**
- `CREATE`: New files to be created
- `MODIFY`: Existing files requiring changes
- `REFERENCE`: Files to read for patterns/context but not modify
- `DEPENDENT`: Files that import modified files (may need updates)

**6e. Determine Creation Order:**
Based on import dependencies, establish the order files must be created/modified to avoid import errors:
- Files with no dependencies on other new files come first
- Files depending on other new files come after their dependencies

**6f. Document the Map:**
You will output this map in the tasks.md file header.

# PHASE 2: Generate Testing Plan

The first task group is ALWAYS the testing plan. Testing comes before implementation.

## Step 1: Determine Test Types

Based on the feature and tech stack, determine which test types apply:

**Priority Order (prefer earlier options):**

1. **Spec Tests (Unit/Integration)** - Preferred for all features
   - Test models, services, utilities, API endpoints
   - Use the test runner from tech-stack.md
   - Place tests in the project's standard test directory

2. **E2E Tests** - For user-facing flows
   - Test complete user journeys through the UI
   - Use E2E framework from tech-stack.md (Playwright, Cypress, etc.)

3. **AI-Executable Tests** - Scripts the AI can run to verify behavior
   - Curl commands for APIs
   - Database queries to verify state
   - CLI commands to test functionality

4. **Manual Tests** - Last resort only
   - Only when automation is impractical
   - Document in `{epic-path}/manual-tests.md`
   - Requires explicit user action

## Step 2: Map Acceptance Criteria to Tests

For each acceptance criterion in the PRD:
- Determine which test type covers it
- Write a specific test case description
- Note the test file location

## Step 3: Create Testing Task Group

Generate Task Group 1 as the Testing Plan with:
- Test file creation tasks
- Specific test cases to write
- Test infrastructure setup if needed
- Commands to run tests

# PHASE 3: Generate Implementation Task Groups

## Step 1: Identify Logical Units

Break the implementation into logical units based on the tech stack and feature type. Common logical units include:

- **Data Layer**: Models, schemas, migrations, database setup
- **Service Layer**: Business logic, utilities, helpers
- **API Layer**: Routes, controllers, endpoints, middleware
- **UI Layer**: Components, pages, styles
- **Integration Layer**: Connecting pieces, wiring up imports/exports
- **Configuration**: Environment variables, feature flags, settings

## Step 2: Apply Sizing Constraints

For each logical unit:

**Primary Constraint - Logical Cohesion:**
- Keep related code together
- A unit should represent a complete, testable piece of functionality

**Secondary Constraint - Context Window Limit (~100k tokens):**
- Estimate the context needed: files to read + files to write + instructions
- If a logical unit exceeds this, split into sub-groups with clear handoff points
- Each sub-group should still be independently verifiable

## Step 3: Order Task Groups

Arrange task groups in dependency order:
1. Testing Plan (always first)
2. Data/Schema layer (if applicable)
3. Service/Business logic layer
4. API layer (if applicable)
5. UI layer (if applicable)
6. Integration and wiring
7. Final verification

## Step 4: Generate Detailed Tasks

For each task group, generate verbose, step-by-step tasks:

**Task Structure:**
```
- [ ] N.0 [Main objective for this task group]
  - [ ] N.1 [Specific sub-task]
    - Step-by-step instructions
    - Exact file path to create/modify
    - Code pattern to follow (reference existing file)
    - Expected behavior when complete
  - [ ] N.2 [Next sub-task]
    - ...
  - [ ] N.X Verify task group completion
    - Specific tests to run
    - Expected outcomes
    - Checkpoint: confirm before proceeding
```

**Verbosity Requirements:**
- Include exact file paths
- Reference specific existing files for patterns
- Describe expected inputs and outputs
- Note error handling requirements
- Include relevant code snippets or patterns from the codebase
- Specify test commands to run

**Migration Handling:**
- Migrations can be generated by the AI using the ORM
- Migrations can be applied to test databases
- Production database migrations: Mark as "USER ACTION REQUIRED"
- Example: `- [ ] 2.4 [USER ACTION REQUIRED] Apply migration to production database`

# PHASE 4: Generate Output

## Step 1: Create tasks.md

Write the complete task list to `{feature-path}/tasks.md` using this structure:

```markdown
# Tasks: {Feature Name}

**Feature:** [{Feature Name}]({feature-path}/prd.md)
**Epic:** [{Epic Name}]({epic-path}/requirements.md)
**Generated:** {YYYY-MM-DD}

## File Dependency Map

### Files to Create (in order)
1. `path/to/file` - [Brief description] - No dependencies
2. `path/to/file` - [Brief description] - Imports: [list]

### Files to Modify
- `path/to/file`
  - Currently imports: [relevant imports]
  - Changes needed: [brief description]
  - Dependents: [files that import this]

### Reference Files (read for patterns)
- `path/to/similar/file` - [What pattern to extract]

---

## Task Groups

### Task Group 1: Testing Plan
**Dependencies:** None
**Estimated Complexity:** [Low/Medium/High]

- [ ] 1.0 Set up test infrastructure for {feature}
  - [ ] 1.1 Create test file structure
    - Create `{test-directory}/{test-file}`
    - Follow pattern from `{existing-test-file}`
    - Import test utilities from `{test-utils-path}`
  - [ ] 1.2 Write test cases for [component/function]
    - Test case: [description from acceptance criteria]
    - Test case: [description from acceptance criteria]
    - Expected: [specific outcomes]
  - [ ] 1.3 Verify test infrastructure
    - Run: `{test-command}`
    - Expected: Tests should fail (implementation not yet complete)
    - Checkpoint: Confirm tests are properly structured before proceeding

### Task Group 2: {Logical Unit Name}
**Dependencies:** Task Group 1
**Estimated Complexity:** [Low/Medium/High]
**Context Needed:** [Key files/concepts from previous groups]

- [ ] 2.0 {Main objective}
  - [ ] 2.1 {Sub-task with verbose instructions}
    - File: `{exact-path}`
    - Pattern: Follow `{reference-file}` for structure
    - Implementation details:
      - [Step 1]
      - [Step 2]
      - [Step 3]
    - Expected behavior: [description]
  - [ ] 2.2 {Next sub-task}
    - ...
  - [ ] 2.X Verify task group completion
    - Run: `{test-command}`
    - Expected: [specific tests] should now pass
    - Verify: [specific behavior to check]
    - Checkpoint: Confirm before proceeding to Task Group 3

[Continue for all task groups...]

### Task Group N: Final Verification
**Dependencies:** All previous task groups
**Estimated Complexity:** Low

- [ ] N.0 Complete feature verification
  - [ ] N.1 Run full test suite for this feature
    - Run: `{test-command}`
    - Expected: All tests pass
  - [ ] N.2 Verify acceptance criteria
    - [ ] {Acceptance criterion 1}: [How to verify]
    - [ ] {Acceptance criterion 2}: [How to verify]
    - [ ] {Acceptance criterion N}: [How to verify]
  - [ ] N.3 Check for regressions
    - Run: `{broader-test-command}` if applicable
    - Verify no existing functionality is broken

---

## Assumptions Made

- [List any assumptions made during task generation]
- [Note any ambiguities that were resolved with reasonable defaults]

## Notes

- [Any additional context or warnings]
- [Known limitations or future considerations]
```

## Step 2: Conditionally Create Manual Tests File

**Only if manual tests are required** (when automation is impractical), create or append to `{epic-path}/manual-tests.md`:

```markdown
# Manual Tests

## {Feature Name}

**Feature:** [{Feature Name}]({feature-path}/prd.md)
**Added:** {YYYY-MM-DD}

### Test: {Test Name}
**Acceptance Criterion:** {Which criterion this tests}

**Prerequisites:**
- [Setup required before testing]

**Steps:**
1. [Exact step to perform]
2. [Next step]
3. [Continue...]

**Expected Result:**
- [What should happen]

**Notes:**
- [Any additional context]

---

[Repeat for each manual test]
```

# Completion

After completing all phases, output a summary:

```
Tasks generated for: {Feature Name}

Task Groups Created: {N}
1. Testing Plan - {complexity}
2. {Task Group Name} - {complexity}
...

Total Tasks: {count}
Test Coverage: {spec/e2e/ai-executable/manual}
Manual Tests Required: {Yes/No}

Files created:
- {feature-path}/tasks.md
- {epic-path}/manual-tests.md (if applicable)

Ready for implementation. Execute task groups in order, verifying each checkpoint before proceeding.
```
