# SLATE

Student Lab/Assignment Template Engine. Generates printable course assignments (homework, quiz, lab) as static HTML.

## How it works

Each assignment is a standalone `.html` file built from shared custom elements (`slate-doc`, `slate-header`, `slate-question`, `slate-subquestion`, `slate-blank`, `slate-diagram`, `slate-section`, `slate-boxnote`, `slate-list`, ...), styled by `slate-shared.css` and auto-numbered/scored by `slate-shared.js`. See `example.html` for an annotated reference of every element.

Circuit diagrams live in `diagrams/`, built with `slate-circuit-lib.js` and embedded via iframe.

## File naming

- `hw_<n>.html`, `quiz_<n>.html` — no topic slug
- `lab_<n>_<topic-slug>.html` — topic slug required, each lab is distinct

## Workflow

No scaffolding tool yet — copy an existing same-type file and edit.

## Versioning

`slate-version.js` holds the current engine version (`YYYYMMDD.n`), bumped automatically on every commit by the `.githooks/pre-commit` hook, which also stamps a `<meta name="slate-version">` tag into any committed assignment file (one with a `<slate-doc>` tag). `slate-shared.js` checks that stamp against the current version on load and alerts if they don't match. After cloning, run once:

```
git config core.hooksPath .githooks
```
