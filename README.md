# Installation Guide
1. run curl command to install oroboros into the project, or update it.
2. Afterwards you have a folder structure like

```
project
├── oroboros/
│   ├── epics/
│   │   └── .gitkeep
│   ├── prompts/
│   ├── reference/
│   │   ├── epic-index.md
│   │   ├── gotchas.md
```

3. Run ./oroboros/prompts/create-mission.md
4. Run ./oroboros/prompts/create-tech-stack.md

# Workflow

1. Define epic with ./create-epic.md
2. Run ./implement (Script) {epic_path}
3. Pr made with the new epic