# Flux PDF Visual Standard (Refactor Track)

This standard defines the minimum visual system for touched desktop/mobile/editor screens.

## 1. Typography

- Family: `--font-sans`, `--font-mono` from `src/assets/main.css`.
- Utility classes:
  - `ui-kicker` for section/meta labels.
  - `ui-label` for action labels and dense UI text.
  - `ui-caption` for supporting text.
  - `ui-mono` for command, shortcut, and technical values.
- Rule: avoid ad-hoc font-size classes when a `ui-*` text utility already matches intent.

## 2. Spacing and Surfaces

- Base spacing unit: `--spacing` (`0.25rem`).
- Standard surfaces:
  - `ui-panel` for primary cards/surfaces.
  - `ui-panel-muted` for secondary grouped areas.
- Rule: prefer surface utilities over one-off border/background combinations.

## 3. Color Roles

- Use semantic tokens only (`--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, and sidebar variants).
- Dark mode must be token-driven via `.dark` overrides in `src/assets/main.css`.
- Rule: avoid hard-coded color values inside feature components unless unavoidable for dynamic visuals.

## 4. Motion

- Default motion duration targets:
  - Fast: 150-200ms (hover/focus/opacity transitions).
  - Standard: 200-300ms (panel/sheet/menu transitions).
  - Emphasis: 400-500ms (theme reveal and major scene transitions).
- Rule: honor reduced-motion using existing guards in `src/assets/main.css`.

## 5. Accessibility Baseline

- Interactive elements must expose accessible names (text or `aria-label`).
- Dialog/Drawer/Sheet usage must include title + description patterns.
- Keyboard interactions should remain available for critical actions (close/cancel, selection, command entry).
