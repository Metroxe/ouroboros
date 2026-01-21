# Oroboros

A prompt-driven development workflow system for AI-assisted software engineering.

## Installation

Install oroboros into any project with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash
```

To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/Metroxe/ouroboros/main/install.sh | bash -s -- v0.2.0
```

### What gets installed

```
your-project/
├── oroboros/
│   ├── .version              # Tracks installed version
│   ├── epics/                # Your epics go here
│   │   └── .gitkeep
│   ├── prompts/              # Workflow prompts
│   │   ├── create-epic.md
│   │   ├── create-features.md
│   │   ├── create-mission.md
│   │   ├── create-task-prompts.md
│   │   ├── create-tasks.md
│   │   └── create-tech-stack.md
│   ├── reference/            # Project context files
│   │   ├── epic-index.md
│   │   ├── gotchas.md
│   │   ├── product-description.md
│   │   └── tech-stack.md
│   └── scripts/              # Compiled automation scripts
│       └── install
```

### Updating

Run the same install command to update. The installer:

- **Updates**: prompts, scripts, and version file
- **Preserves**: your epics, product-description.md, tech-stack.md, and any gotchas you've added

## Getting Started

After installation:

1. Run `oroboros/prompts/create-mission.md` to define your product
2. Run `oroboros/prompts/create-tech-stack.md` to document your technical choices

## Workflow

1. Define an epic with `oroboros/prompts/create-epic.md`
2. Run `./oroboros/scripts/implement {epic_path}` (coming soon)
3. Review and merge the generated PR

## Requirements

- macOS (Apple Silicon) for compiled scripts
- Cursor IDE or similar AI-enabled editor for running prompts
