# Ouroboros - LLM Context Guide

This document provides comprehensive context about the Ouroboros repository for LLMs working within this codebase.

## What is Ouroboros?

Ouroboros is a **prompt-driven development workflow system** for AI-assisted software engineering. It provides a structured framework that helps LLMs (like Claude, Cursor, or OpenCode) systematically plan and implement software features through a series of well-defined prompts.

The core idea: Instead of ad-hoc prompting, Ouroboros provides a repeatable workflow that breaks down large software projects into manageable pieces, with clear handoffs between planning and implementation phases.

## How It Works

Ouroboros follows a hierarchical decomposition approach:

```
Mission → Epic → Features → Tasks → Task Prompts → Implementation
```

1. **Mission** (`create-mission.md`): Define the overall product vision, target users, and scope boundaries
2. **Epic** (`create-epic.md`): A significant chunk of work with clear requirements (e.g., "user authentication")
3. **Features** (`create-features.md`): Break an epic into half-day sized implementable units
4. **Tasks** (`create-tasks.md`): Break each feature into specific implementation steps
5. **Task Prompts** (`create-task-prompts.md`): Generate executable prompts for each task group
6. **Implementation** (`implement-epic`): Automated script that runs all prompts and implements the epic

## Repository Structure

```
ouroboros/
├── PROMPT.md                 # This file - LLM context guide
├── README.md                 # User-facing documentation
├── install.sh                # Installer script (curl | bash)
├── implement-epic-explanation.md  # Detailed docs for the implement-epic script
│
├── oroboros/                 # The installable framework (gets copied to user projects)
│   ├── .version              # Current version number
│   ├── prompts/              # The core workflow prompts
│   │   ├── create-mission.md     # Define product vision
│   │   ├── create-epic.md        # Create and scope an epic
│   │   ├── create-features.md    # Break epic into features
│   │   ├── create-tasks.md       # Break features into tasks
│   │   ├── create-task-prompts.md # Generate implementation prompts
│   │   └── iterate-epic.md       # Iterate on existing epic
│   │
│   ├── reference/            # Project-specific context (preserved on update)
│   │   ├── product-description.md  # Product mission (user-created)
│   │   ├── tech-stack.md           # Technologies in use (user-created)
│   │   ├── epic-index.md           # Index of all epics (Planning/In Progress/Complete)
│   │   └── gotchas.md              # Known issues and pitfalls
│   │
│   ├── epics/                # Where epic folders are created
│   │   └── {date}-{epic-name}/
│   │       ├── requirements.md     # Epic requirements from create-epic.md
│   │       ├── features-index.yml  # Feature summary from create-features.md
│   │       └── features/
│   │           └── {NN}-{feature-name}/
│   │               ├── prd.md              # Feature PRD
│   │               ├── tasks.md            # Task breakdown
│   │               ├── development-notes.md # Implementation notes
│   │               └── prompts/
│   │                   ├── progress.yml    # Task completion tracking
│   │                   ├── 1-{task}.md     # First task prompt
│   │                   ├── 2-{task}.md     # Second task prompt
│   │                   └── ...
│   │
│   └── scripts/              # Executable scripts
│       └── implement-epic    # Compiled automation script
│
├── scripts-src/              # Source code for compiled scripts
│   ├── build.sh              # Build script
│   ├── package.json          # Dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── lib/                  # Shared library code
│   │   ├── agent/            # LLM runtime adapters
│   │   │   ├── claude.ts         # Claude Code CLI adapter
│   │   │   ├── cursor.ts         # Cursor CLI adapter
│   │   │   ├── opencode.ts       # OpenCode CLI adapter
│   │   │   ├── formatting.ts     # Output formatting
│   │   │   ├── types.ts          # Type definitions
│   │   │   └── index.ts          # Runtime detection/selection
│   │   ├── cli.ts            # CLI prompt utilities
│   │   ├── epic.ts           # Epic/feature parsing utilities
│   │   ├── fs.ts             # File system utilities
│   │   ├── git.ts            # Git operations
│   │   ├── version.ts        # Version handling
│   │   └── yaml.ts           # YAML parsing
│   └── scripts/
│       ├── implement-epic.ts # Main automation script
│       └── install.ts        # Install script source
│
├── tests/                    # Test suite
│   ├── e2e/                  # End-to-end tests
│   ├── fixtures/             # Test fixtures
│   ├── helpers/              # Test utilities
│   └── spec/                 # Unit tests
│
└── .github/workflows/        # CI/CD
    ├── build-release.yml     # Build and publish releases
    └── release-please.yml    # Automated versioning
```

## The Prompt Workflow

### 1. create-mission.md
Creates `oroboros/reference/product-description.md` with:
- Mission statement
- Problem statement
- Target users
- Value proposition
- Success criteria
- Out of scope items

### 2. create-epic.md
Interactive prompt that:
- Creates dated epic folder (`YYYY-MM-DD-{epic-name}`)
- Asks clarifying questions about requirements
- Checks for visual assets
- Reviews related epics for context
- Saves `requirements.md`
- Updates `epic-index.md`

### 3. create-features.md
Autonomous prompt that:
- Reads epic requirements
- Searches codebase for patterns
- Breaks epic into ~half-day features
- Creates feature folders with PRDs
- Generates `features-index.yml`

### 4. create-tasks.md
For each feature:
- Reads feature PRD and context
- Breaks into atomic, testable tasks
- Groups related tasks together
- Outputs `tasks.md`

### 5. create-task-prompts.md
For each feature:
- Reads tasks and groups them
- Generates executable prompt files
- Creates `progress.yml` for tracking
- Outputs numbered prompt files (1-{name}.md, 2-{name}.md, etc.)

### 6. implement-epic (script)
Automated pipeline that:
- Detects progress and resumes
- Runs planning prompts (features → tasks → task prompts)
- Executes each implementation prompt
- Commits after each step
- Manages branches and PRs

## Key Concepts

### Epic Lifecycle
1. **Planning**: Epic defined, requirements captured
2. **In Progress**: Being implemented (features/tasks created)
3. **Complete**: All features implemented

### Feature Connections
Features are implemented sequentially (01, then 02, then 03). Each feature:
- Can depend on earlier features (lower numbers)
- Can provide components to later features (higher numbers)
- Never depends on later features

### Progress Tracking
`progress.yml` in each feature's prompts folder tracks which task groups are complete:
```yaml
task_groups:
  - name: testing-plan
    prompt_file: 1-testing-plan.md
    completed: true
  - name: implementation
    prompt_file: 2-implementation.md
    completed: false
```

### Supported LLM Runtimes
- **Claude Code** (`claude` CLI): Full token tracking, cost estimation
- **Cursor** (`cursor` CLI): IDE integration
- **OpenCode** (`opencode` CLI): Alternative runtime

## Development

### Building
```bash
cd scripts-src
bun install
./build.sh
```

### Testing
```bash
cd scripts-src
bun test
```

### Release Process
Uses release-please for automated versioning. Commits with conventional commit messages trigger releases.

## Important Files for LLMs

When working on this codebase, key files to understand:

1. **Prompts** (`oroboros/prompts/*.md`): The core workflow definitions
2. **implement-epic.ts** (`scripts-src/scripts/implement-epic.ts`): Main automation logic
3. **Agent adapters** (`scripts-src/lib/agent/*.ts`): LLM runtime integrations
4. **Epic utilities** (`scripts-src/lib/epic.ts`): Epic/feature parsing

## Conventions

- Kebab-case for folder names
- Date prefix for epic folders (YYYY-MM-DD)
- Two-digit numbering for features (01, 02, 03)
- Feature PRDs follow strict template structure
- Tasks are atomic and independently testable
- Commits use conventional commit format (feat:, fix:, docs:, wip:)
