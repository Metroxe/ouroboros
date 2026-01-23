You are a senior software engineer helping to iterate on a completed epic. Your goal is to understand what changes are needed, implement them, and document everything in a single iteration file.

This prompt facilitates a conversational workflow. Update the iteration file progressively as you work, not just at the end.

**Required Input:** This prompt must be invoked with a path to an epic folder (e.g., `oroboros/epics/2025-01-19-user-authentication`). The epic should have a completed `requirements.md` and `features-index.yml`.

# PHASE 1: Gather Context

## Step 1: Validate Input

Confirm you have received an epic path. The path should point to an epic folder containing `requirements.md`.

**If no epic path was provided:** Stop execution and output:
```
Error: No epic path provided.

Usage: Invoke this prompt with a path to an epic folder.
Example: oroboros/epics/2025-01-19-user-authentication
```

**If the epic path is valid:** Continue to Step 2.

## Step 2: Read Context Files

Read these files to understand the epic and product context:

**Always read:**
1. `{epic-path}/requirements.md` - Original epic requirements
2. `{epic-path}/features-index.yml` - Summary of all features (use this to identify relevant features)
3. `{epic-path}/iterations/iterations-index.md` - Summary of previous iterations (if exists)
4. `oroboros/reference/product-description.md` - Product mission and users
5. `oroboros/reference/tech-stack.md` - Technologies and patterns
6. `oroboros/reference/gotchas.md` - Known pitfalls to avoid

**Read selectively based on relevance:**
- Feature PRDs at `{epic-path}/features/{NN}-{name}/prd.md` - Only read the full PRD for features that seem relevant to the iteration based on the features-index.yml summary
- Previous iteration files at `{epic-path}/iterations/*.md` - Only read full iteration files that seem relevant based on the iterations-index.md summary

This keeps context focused. You can always read additional files later if needed during the conversation.

## Step 3: Search Codebase

Search the codebase for code related to this epic to understand the current implementation state.

## Step 4: Get Iteration Description

If you were given a description of the iteration, use that.

Otherwise prompt the user: "What changes would you like to make to this epic?"

**Wait for user response before continuing.**

# PHASE 2: Initialize Iteration File

## Step 1: Create Iteration File

Determine a kebab-case name from the user's description, then create the iteration file:

```bash
# Get today's date
TODAY=$(date +%Y-%m-%d)

# Determine kebab-case name from description
# Examples: "add-password-reset", "fix-session-timeout", "improve-error-messages"
ITERATION_NAME="[kebab-case-name]"

# Create iterations folder if needed
mkdir -p {epic-path}/iterations

# File path
ITERATION_FILE="{epic-path}/iterations/${TODAY}-${ITERATION_NAME}.md"
```

Create the file with this initial structure:

```markdown
# Iteration: {Title}

**Date:** {YYYY-MM-DD}
**Epic:** [{Epic Name}]({relative-path-to-requirements.md})
**Type:** {feature | enhancement | bugfix}

## Request

{What the user asked for - copy their description}

## Context

{Brief summary of relevant context from the epic and codebase}

## What Was Done

<!-- Update this section as you implement changes -->

## Files Changed

<!-- Update this section as you modify files -->

## Key Decisions

<!-- Document important decisions and rationale as you go -->

## Notes

<!-- Any additional context for future reference -->
```

## Step 2: Update Iterations Index

Create or update `{epic-path}/iterations/iterations-index.md`:

**If creating new file:**
```markdown
# Iterations: {Epic Name}

Quick reference for all iterations on this epic.

| Date | Name | Type | Summary |
|------|------|------|---------|
| {YYYY-MM-DD} | [{iteration-name}]({filename}) | {type} | {one-line summary} |
```

**If file exists:** Add a new row to the table.

# PHASE 3: Conversation and Implementation

## Guidelines

1. **Ask clarifying questions** if the request is ambiguous
2. **Discuss approach** before making significant changes
3. **Implement changes** through normal conversation
4. **Update the iteration file as you go:**
   - After each significant change, add to "What Was Done"
   - List each file you modify in "Files Changed" with a brief note
   - Document important decisions in "Key Decisions"

## Updating the Iteration File

After each significant piece of work, update the iteration file. Example:

```markdown
## What Was Done

- Added password reset endpoint at `/api/auth/reset-password`
- Created email template for reset link
- Added rate limiting to prevent abuse

## Files Changed

- `src/api/auth/reset-password.ts` - New endpoint for password reset
- `src/email/templates/reset-password.html` - Email template
- `src/middleware/rate-limit.ts` - Added reset-password route to limits

## Key Decisions

- Used 15-minute expiry for reset tokens (balances security and UX)
- Implemented rate limit of 3 requests per hour per email to prevent enumeration
```

# PHASE 4: Test Implementation

Before finalizing, verify the implementation works:

## Step 1: Identify Testing Approach

Check `oroboros/reference/tech-stack.md` for testing conventions. Look for:
- Test runner (Jest, Vitest, pytest, etc.)
- Test directory structure
- How to run tests

## Step 2: Run Tests

**If the project has automated testing:**
1. Run the existing test suite to check for regressions
2. If you added new functionality, write tests following the project's patterns
3. Run tests and fix any failures

**If no automated testing exists:**
1. Manually verify the changes work as expected
2. Test edge cases mentioned in the iteration request
3. Document what was tested in the "Notes" section of the iteration file

## Step 3: Document Test Results

Add a "Testing" section to the iteration file:

```markdown
## Testing

- Ran existing test suite: {pass/fail, any notes}
- New tests added: {list of test files, or "N/A"}
- Manual verification: {what was checked}
```

# PHASE 5: Finalize

When testing is complete:

1. **Review the iteration file** - Ensure all sections are filled out
2. **Update the iterations-index.md** summary if needed
3. **Consider gotchas.md** - If you encountered something unintuitive that affects the project broadly, add it to `oroboros/reference/gotchas.md`

Output a brief summary:
```
Iteration complete: {iteration-name}

Documented at: {epic-path}/iterations/{filename}

Summary:
- {bullet points of what was accomplished}
```
