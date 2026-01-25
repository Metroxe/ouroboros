<p align="center">
  <img src="assets/banner.png" alt="Ouroboros Banner" width="100%">
</p>

# Ouroboros

A prompt-driven development workflow system for AI-assisted software engineering.

## Installing/Updating

### Prerequisites

- Git
- [GitHub CLI](https://cli.github.com/) (`gh`)
- At least one LLM runtime:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude` CLI)
  - [Cursor](https://cursor.com/docs/cli/overview) (`cursor` CLI)
  - [OpenCode](https://opencode.ai/) (`opencode` CLI)

### Install

Install or update oroboros in any project:

```bash
curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash
```

To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash -s -- v0.2.0
```

## One-Time Setup

After installing, set up your project context:

1. **Define your product mission** - Run the create-mission prompt to establish your product vision:
   ```
   oroboros/prompts/create-mission.md
   ```
   This creates `oroboros/reference/product-description.md`.

2. **Define your tech stack** - Run the create-tech-stack prompt:
   ```
   oroboros/prompts/create-tech-stack.md
   ```
   This creates `oroboros/reference/tech-stack.md`.

3. **Document gotchas** - Add known issues and pitfalls to `oroboros/reference/gotchas.md`. These should be things that are **not inferable from the code** - external constraints, historical decisions, or non-obvious quirks. Examples:
   ```markdown
   ## Infrastructure
   - Production database has a 5-second query timeout enforced at the proxy level
   - The staging environment shares a Redis instance with another team's project
   - Deployments are blocked on Fridays after 2pm by company policy

   ## Third-Party Services
   - Stripe webhooks must respond within 10 seconds or they get retried
   - The legacy PDF service (pdf.internal.corp) only accepts files under 10MB
   - Our SendGrid account is on a plan that limits to 10k emails/day

   ## Historical Decisions
   - User IDs are UUIDs because we migrated from a system that used them - don't change to auto-increment
   - The "archived" flag on projects is soft-delete; some clients still query archived data via the legacy API
   ```

## Running Prompts

You can reference any prompt file directly in your LLM conversation. For example:

```
Run oroboros/prompts/create-epic.md
```

The LLM will follow the instructions in that prompt file.

## Workflow: Epic Development

For planned features and multi-day work, use the epic workflow:

### Step 1: Create the Epic

Run `oroboros/prompts/create-epic.md` and have a conversation about what you want to build. The prompt will ask clarifying questions and save requirements to `oroboros/epics/{date}-{epic-name}/requirements.md`.

**Highly recommended:** Commit your changes before Step 2, especially if you have not `.gitignore`d the oroboros folder.

### Step 2: Implement the Epic

Run the implementation script:

```bash
./oroboros/scripts/implement-epic
```

See [docs/implement-epic-explanation.md](docs/implement-epic-explanation.md) for CLI options, configuration details, and troubleshooting.

### Step 3: Verify the Output

After implementation completes, review the verification guide:

```
oroboros/epics/{epic-name}/verification-guide.md
```

This contains manual testing steps to verify the implementation works correctly.

### Step 4: Iterate if Needed

For bug fixes or additions to the epic, run:

```
oroboros/prompts/iterate-epic.md
```

This guides you through adding features or fixing issues in the existing epic.

## Workflow: Sessions

For smaller tasks that don't need the full epic pipeline (debugging, exploration, refactoring, quick fixes), use sessions instead.

### Starting a Session

Run `oroboros/prompts/create-session.md` and describe what you want to work on. The prompt will:
- Gather context from your reference files
- Create a session file at `oroboros/sessions/{date}-{topic}.md`
- Track decisions, code changes, and next steps

### Resuming a Session

When you need to continue a session in a new context window, reference the session file:

```
Resume oroboros/sessions/2025-01-24-debug-auth-flow.md
```

The prompt will recover the context and continue where you left off.
