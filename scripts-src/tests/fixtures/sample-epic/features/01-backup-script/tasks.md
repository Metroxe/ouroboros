# Tasks: Backup Script

**Feature:** [Backup Script](prd.md)
**Epic:** [Bash Utility Scripts](../../requirements.md)
**Generated:** 2025-01-21

## File Dependency Map

### Files to Create (in order)
1. `scripts/backup.sh` - Main backup script - No dependencies

### Reference Files (read for patterns)
- None (first script in project)

---

## Task Groups

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
