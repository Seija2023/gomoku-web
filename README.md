# Gomoku Web

A local-first 15×15 Gomoku game, analysis lab and adaptive training workspace built with HTML, CSS and JavaScript.

**Current version: v2.8.1 — Engineering Governance**

Live site: https://seija2023.github.io/gomoku-web/

## Highlights

- Local PVP and AI play
- Worker-based Local AI 2.0 with main-thread fallback
- Iterative Deepening, Alpha-Beta, tactical priority and Transposition Table
- Candidate A/B/C, Heatmap, Ghost Line 2.0 and Search Inspector
- Position Editor and Counterfactual Analysis
- Persistent Variation Tree with manual and AI branches
- Adaptive Training generated from personal game history
- Mistake Book, weakness tracking and spaced repetition
- Review timeline, advantage chart, sharing and challenge links
- Desktop and mobile workspace navigation
- Single-file offline Standalone build
- No backend, cloud AI API or API key required

## Workspaces

The UI is organized into four focused workspaces:

| Workspace | Purpose |
| --- | --- |
| 对局 | PVP / AI, undo, restart, history |
| 分析 | candidates, Ghost Line, Heatmap, AI explanation, Search Inspector |
| 训练 | adaptive sessions, mistake training, weakness and profile |
| 实验室 | Position Editor, Variation Tree, opening history |

Special activities such as review, training and variation analysis are coordinated by the application Workspace layer to prevent conflicting modes.

## Architecture

The project uses explicit layers rather than a single page script:

```text
UI
 ↓
Controller / Workflow
 ↓
Service
 ↓
Domain / Analysis / AI
 ↓
Core
```

Key application components:

- `WorkspaceManager` — unified activity / workspace state
- `SessionWorkflow` — cross-controller session transitions
- `RenderCoordinator` — display position and region rendering decisions
- `AIClient` — stable Worker / main-thread AI boundary
- `DerivedService` — cached training / profile / opening derivations
- `StorageMigrations` — forward-compatible localStorage schema

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Repository Layout

```text
.
├─ .github/       CI and contribution templates
├─ css/           layout, board, components and responsive styles
├─ docs/          architecture, usage, development and release docs
├─ js/
│  ├─ app/
│  ├─ core/
│  ├─ game/
│  ├─ ai/
│  ├─ analysis/
│  ├─ services/
│  ├─ controllers/
│  ├─ training/
│  ├─ lab/
│  ├─ storage/
│  ├─ platform/
│  └─ ui/
├─ scripts/       build, architecture lint and browser smoke
├─ tests/         Node test suite
├─ index.html
└─ package.json
```

Generated `dist/` output is intentionally not tracked.

## Development

Requires Node.js 22 or newer.

Run the complete quality gate:

```bash
npm run check
```

Or run stages individually:

```bash
npm run lint
npm test
npm run build
npm run smoke
```

### Quality gates

CI validates:

1. architecture and repository boundaries
2. Node unit / structure / syntax tests
3. Standalone build
4. real Chrome end-to-end smoke
5. standalone Blob Worker behavior
6. desktop and 390px mobile critical paths

The architecture lint also prevents generated `dist/` files from being committed and keeps documentation aligned with the package version.

## Standalone

Build a single-file offline version:

```bash
npm run build
```

Output:

```text
dist/gomoku.html
```

The Standalone embeds application assets and a Blob Worker. CI uploads the generated file as an artifact after successful validation.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Usage](docs/USAGE.md)
- [Development](docs/DEVELOPMENT.md)
- [Release Process](docs/RELEASING.md)
- [Changelog](docs/CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## Data

Game history, settings, training progress and saved variation trees are stored locally in the browser. Clearing site data removes these records.

Current storage schema: **5**.

## Rules

The game currently uses basic freestyle Gomoku rules. Renju forbidden-move rules such as double-three, double-four and overline restrictions are not implemented.
