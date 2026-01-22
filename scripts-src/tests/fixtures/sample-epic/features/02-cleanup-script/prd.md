# Feature: Cleanup Script

**Epic:** [Bash Utility Scripts](../../requirements.md)
**Sequence:** 02 of 2

## Overview

Create a bash script that removes common temporary files and build artifacts from a project directory. The script should support a dry-run mode to preview what would be deleted.

## Functional Requirements

- Accept target directory as first argument (defaults to current directory)
- Remove common temporary files: .log, .tmp, .bak, .swp
- Remove common build artifacts: node_modules, __pycache__, .cache, dist, build
- Support -n/--dry-run to preview without deleting
- Support -h/--help to show usage
- Support -v/--verbose for detailed output

## Technical Approach

- **Files to Create:** `scripts/cleanup.sh`
- **Key Implementation Details:** Use find command for file discovery, rm for deletion

## Acceptance Criteria

- [ ] Script is executable and has proper shebang
- [ ] Running with -h shows help text
- [ ] Dry-run mode shows what would be deleted without deleting
- [ ] Removes all specified file types
- [ ] Removes all specified directories
- [ ] Verbose mode shows each item removed
- [ ] Returns exit code 0 on success, 1 on error

## Out of Scope

- Custom patterns via config file
- Recursive into subdirectories for specific patterns only
- Undo/restore functionality
