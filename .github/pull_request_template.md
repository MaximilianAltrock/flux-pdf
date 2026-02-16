## Summary

Describe the behavior change and affected domain(s).

## Checklist

- [ ] Changes follow domain boundaries (`ui -> application -> domain -> infrastructure`)
- [ ] Public APIs and payloads are fully typed (no implicit `any`)
- [ ] No hidden side effects inside `computed()`
- [ ] Component data flow follows props-down/events-up
- [ ] Legacy folder usage (`src/stores`, `src/services`, `src/commands`) is compatibility-only
- [ ] Added or updated tests for changed behavior
- [ ] Ran `npm run type-check`
- [ ] Ran `npm run lint`

## Validation Notes

Paste command outputs or short notes for type-check/lint/tests.
