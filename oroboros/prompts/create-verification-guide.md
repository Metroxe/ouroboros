You are a senior engineer creating a verification guide for a completed epic. Your goal is to write a practical guide that helps someone manually test and verify the epic works.

This prompt is fully autonomous and requires no user interaction. Execute each phase in sequence.

**Required Input:** This prompt must be invoked with a path to an epic folder (e.g., `oroboros/epics/2025-01-19-user-authentication`). The epic should have completed implementation.

# PHASE 1: Context Gathering

## Step 1: Validate Input

Confirm you have received an epic path. The path should point to an epic folder containing `requirements.md`.

**If no epic path was provided:** Stop execution and output:
```
Error: No epic path provided.

Usage: Invoke this prompt with a path to an epic folder.
Example: oroboros/epics/2025-01-19-user-authentication
```

**If the epic path is valid:** Continue to Step 2.

## Step 2: Read Epic Context

Read these files to understand what was built:

1. `{epic-path}/requirements.md` - What the epic aimed to accomplish
2. `{epic-path}/features-index.yml` - Summary of all features
3. All `{epic-path}/features/*/development-notes.md` files - Implementation details and decisions

## Step 3: Analyze Implemented Code

**Tip:** If the `gh` CLI is available and you're on a branch other than main, use `git diff main...HEAD` to identify what files and code were added or changed by this epic. This helps focus on what's new rather than analyzing the entire codebase.

Search the codebase to identify:

**Entry Points:**
- API endpoints created (routes, controllers)
- CLI commands or scripts added
- UI pages or components
- Background jobs or workers

**Configuration Requirements (new ones only):**
- Environment variables **added by this epic** (not pre-existing ones like `DATABASE_URL` that were already in the project)
- New config files or config sections added
- New third-party services or API keys required by this epic

**Database Changes:**
- Migration files created
- New tables or columns added
- Schema changes
- Seed data requirements

**Services and Dependencies:**
- External services to run (databases, Redis, etc.)
- Docker containers needed
- Background processes to start

# PHASE 2: Generate Verification Guide

Create `{epic-path}/verification-guide.md` with the following structure:

```markdown
# Verification Guide: {Epic Name}

How to manually verify this epic works as expected.

## Prerequisites

### Environment Variables

{List any NEW environment variables added by this epic, with example values where appropriate. Do not include pre-existing variables like DATABASE_URL that were already in the project.}

```bash
export VARIABLE_NAME=value
```

{Or "No new environment variables required." if none}

### Services to Run

{List any services that need to be running - databases, Redis, external APIs, etc.}

{Or "No additional services required." if none}

### Dependencies

{Any packages to install, build steps to run, etc.}

```bash
# Example commands
npm install
npm run build
```

## Database Changes

{If there were database changes, list them here}

**Migration files:**
- `{path/to/migration}` - {brief description}

**New tables/columns:**
- `{table_name}` - {purpose}

**To apply migrations:**
```bash
{migration command}
```

{Or "No database changes in this epic." if none}

## How to See It Working

{Step-by-step instructions to exercise the feature}

### {Action or Flow Name}

1. {Step 1}
2. {Step 2}
3. {Step 3}

**Expected result:** {What you should see}

{Repeat for other key flows}

## What to Look For

### Expected Behaviors

- {Specific behavior to verify}
- {Another behavior}

### Logs

{What log messages indicate success}

```
{Example log output}
```

### Common Issues

{If something isn't working, what to check}

- {Issue}: {How to diagnose/fix}

## Quick Verification Checklist

- [ ] {First thing to verify}
- [ ] {Second thing to verify}
- [ ] {Third thing to verify}
```

**Guidelines for writing the guide:**

- Be concise - focus on what's needed to verify, not comprehensive documentation
- Include copy-paste-able commands where possible
- Omit sections that don't apply (e.g., skip "Database Changes" if there were none)
- Focus on the happy path first, then edge cases
- Use concrete examples with realistic sample data
- Only include things **added by this epic** - not pre-existing config, env vars, or setup steps

# PHASE 3: Output Summary

After creating the file, output:

```
Verification guide created: {epic-path}/verification-guide.md

The guide covers:
- Prerequisites: {brief summary}
- Database changes: {yes/no}
- Key verification steps: {count}
```
