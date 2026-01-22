You are implementing task group 2 for feature: 01-backup-script

# Task Group 2: Implementation

## Context Files to Read

Before implementing, read these files to understand the context:

1. `features/01-backup-script/prd.md` - Feature requirements and acceptance criteria
2. `features/01-backup-script/tasks.md` - Full task list
3. `requirements.md` - Epic context and scope
4. `features/01-backup-script/development-notes.md` - Notes from previous task groups

## Task Group to Implement

### Task Group 2: Implementation
**Dependencies:** Task Group 1
**Estimated Complexity:** Medium

- [ ] 2.0 Implement backup script
  - [ ] 2.1 Create script file with shebang
    - File: `scripts/backup.sh`
    - Make executable
  - [ ] 2.2 Implement argument parsing
    - Parse -h/--help
    - Parse -v/--verbose
    - Parse -e/--extension
    - Parse positional args (source, dest)
  - [ ] 2.3 Implement backup logic
    - Validate source directory exists
    - Create timestamped destination directory
    - Copy files (with optional extension filter)
    - Output verbose info if enabled
  - [ ] 2.4 Verify implementation
    - Run: `./tests/test-backup.sh`
    - Expected: All tests pass

## Implementation Instructions

1. Read all context files listed above
2. Implement the backup script following the PRD requirements
3. Run tests to verify implementation

## After Implementation

### 1. Update tasks.md

Mark completed tasks in `features/01-backup-script/tasks.md`:
- Change `- [ ]` to `- [x]` for each completed task

### 2. Update progress.yml

In `features/01-backup-script/prompts/progress.yml`, set this task group's `completed` to `true`:
```yaml
  - name: implementation
    completed: true
```

### 3. Add to development-notes.md

Append notes about implementation decisions.

### 4. Mark Feature Complete

This is the final task group for this feature. Update the feature's completion status in `features-index.yml`:

```yaml
  - number: "01"
    name: backup-script
    completed: true
```
