# Feature: Backup Script

**Epic:** [Bash Utility Scripts](../../requirements.md)
**Sequence:** 01 of 2

## Overview

Create a bash script that backs up files from a source directory to a timestamped backup directory. The script should support filtering by file extension and provide verbose output.

## Functional Requirements

- Accept source directory as first argument
- Accept destination directory as second argument (optional, defaults to ./backups)
- Create timestamped subdirectory (YYYY-MM-DD_HHMMSS format)
- Copy all files from source to timestamped backup
- Support -e/--extension flag to filter by file type
- Support -h/--help to show usage
- Support -v/--verbose for detailed output

## Technical Approach

- **Files to Create:** `scripts/backup.sh`
- **Key Implementation Details:** Use getopts for argument parsing, cp for file copying

## Acceptance Criteria

- [ ] Script is executable and has proper shebang
- [ ] Running with -h shows help text
- [ ] Running without arguments shows usage error
- [ ] Creates timestamped directory in destination
- [ ] Copies all files when no extension filter
- [ ] Only copies matching files when extension filter used
- [ ] Verbose mode shows each file copied
- [ ] Returns exit code 0 on success, 1 on error

## Out of Scope

- Incremental backups
- Compression
- Remote destinations
