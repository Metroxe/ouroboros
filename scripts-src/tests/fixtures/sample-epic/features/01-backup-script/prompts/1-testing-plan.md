You are implementing task group 1 for feature: 01-backup-script

# Task Group 1: Testing Plan

## Context Files to Read

Before implementing, read these files to understand the context:

1. `features/01-backup-script/prd.md` - Feature requirements and acceptance criteria
2. `features/01-backup-script/tasks.md` - Full task list
3. `requirements.md` - Epic context and scope

## Task Group to Implement

### Task Group 1: Testing Plan
**Dependencies:** None
**Estimated Complexity:** Low

- [ ] 1.0 Set up test infrastructure
  - [ ] 1.1 Create test directory structure
    - Create `tests/test-backup.sh`
    - Include test helper functions
  - [ ] 1.2 Write test cases
    - Test: Help flag shows usage
    - Test: Missing source directory returns error
    - Test: Creates timestamped backup directory
    - Test: Copies files correctly
    - Test: Extension filter works
  - [ ] 1.3 Verify test infrastructure
    - Run tests (they should fail initially)
    - Checkpoint: Confirm tests are structured

## Implementation Instructions

1. Read all context files listed above
2. Create the test file with bash test functions
3. Write tests that will initially fail (TDD approach)

## After Implementation

### 1. Update tasks.md

Mark completed tasks in `features/01-backup-script/tasks.md`:
- Change `- [ ]` to `- [x]` for each completed task

### 2. Update progress.yml

In `features/01-backup-script/prompts/progress.yml`, set this task group's `completed` to `true`:
```yaml
  - name: testing-plan
    completed: true
```

### 3. Add to development-notes.md

Append notes about test structure and approach.
