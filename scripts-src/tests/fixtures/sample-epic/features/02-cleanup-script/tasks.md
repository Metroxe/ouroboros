# Tasks: Cleanup Script

**Feature:** [Cleanup Script](prd.md)
**Epic:** [Bash Utility Scripts](../../requirements.md)
**Generated:** 2025-01-21

## File Dependency Map

### Files to Create (in order)
1. `scripts/cleanup.sh` - Main cleanup script - No dependencies

### Reference Files (read for patterns)
- `scripts/backup.sh` - Reference for argument parsing style

---

## Task Groups

### Task Group 1: Testing Plan
**Dependencies:** None
**Estimated Complexity:** Low

- [ ] 1.0 Set up test infrastructure
  - [ ] 1.1 Create test file
    - Create `tests/test-cleanup.sh`
  - [ ] 1.2 Write test cases
    - Test: Help flag shows usage
    - Test: Dry-run shows files without deleting
    - Test: Removes .log files
    - Test: Removes node_modules directory
    - Test: Verbose mode works
  - [ ] 1.3 Verify tests run
    - Checkpoint: Tests should fail initially

### Task Group 2: Implementation
**Dependencies:** Task Group 1
**Estimated Complexity:** Medium

- [ ] 2.0 Implement cleanup script
  - [ ] 2.1 Create script with shebang
    - File: `scripts/cleanup.sh`
  - [ ] 2.2 Implement argument parsing
    - Parse -h/--help, -n/--dry-run, -v/--verbose
  - [ ] 2.3 Implement cleanup logic
    - Find and remove temporary files
    - Find and remove build directories
    - Respect dry-run flag
  - [ ] 2.4 Verify implementation
    - Run tests, all should pass
