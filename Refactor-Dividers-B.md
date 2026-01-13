# Divider Refactor Option B (Store-Level Separation)

Goal
Remove divider entries from the main pages list so the core logic works only with
real pages. Dividers become structural markers stored separately and merged only
for UI rendering.

Proposed data model
- pages: PageReference[]
- dividers: DividerMarker[]
  - DividerMarker: { id: string, afterPageId?: string, position?: number }
  - Choose one anchor: afterPageId is stable across reorders; position is simpler but
    must be recomputed when pages move.

Key refactor steps
1) Types and store
   - Replace PageEntry union with explicit pages + dividers state.
   - Add a selector that merges pages and dividers into a GridEntry[] just for UI.
   - Selection remains page-only (no divider ids in selection sets).

2) Commands
   - SplitGroupCommand: insert a DividerMarker (not a virtual page).
   - ReorderPagesCommand: reorder pages only.
   - MoveDividerCommand (new): move divider markers between pages and show
     "Move divider" in history.

3) Export and document logic
   - Replace "scan pages for isDivider" with a splitter that uses dividers to
     compute segments.
   - Keep dividers out of contentPages and any page-only transforms.

4) Persistence and migrations
   - Add a migration to extract divider entries from stored pages:
     - pages = oldPages.filter(isPageEntry)
     - dividers = oldPages.filter(isDividerEntry).map(toDividerMarker)
   - Update history serialization if new command types are introduced.

5) UI
   - Grid uses the merged GridEntry[] and never checks isDivider in business logic.
   - Dragging a divider triggers MoveDividerCommand instead of ReorderPagesCommand.

Tradeoffs
- Larger refactor: touches store shape, commands, export logic, and migrations.
- Requires history compatibility plan.
- Long-term benefit: fewer isDivider checks and clearer separation of concerns.
