## Summary

Describe the behavior change and affected domain(s).

## Checklist

- [ ] Changes follow domain boundaries (`ui -> application -> domain -> infrastructure`)
- [ ] Public APIs and payloads are fully typed (no implicit `any`)
- [ ] No hidden side effects inside `computed()`
- [ ] Component data flow follows props-down/events-up
- [ ] Legacy folders (`src/stores`, `src/services`, `src/commands`) are not used
- [ ] Added or updated tests for changed behavior
- [ ] Ran `npm run type-check`
- [ ] Ran `npm run lint`
- [ ] Ran `npm run test:unit:run`
- [ ] Ran `npm run test:e2e` for UI/interaction changes
- [ ] Ran `npm run validate:shadcn` for UI primitive/config changes
- [ ] Ran `npm run validate:a11y-overlays` for dialog/sheet/drawer changes
- [ ] Ran `npm run validate:architecture` for legacy-path/SFC/JSX guardrails

## Validation Notes

Paste command outputs or short notes for type-check/lint/tests.
