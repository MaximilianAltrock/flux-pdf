## 1. Architectural overview

Your PDF editor behaves like a **rich client application** (similar to VS Code or Photoshop) with:

- Long‑lived state (document, pages, metadata, tools).
- A complex **history system**.
- High interaction density.

For such apps, modern frontend architecture guidance converges on:

- **Domain‑modular structure** (group by feature/domain, not by file type) for maintainability and scalability.[^1][^2][^3]
- **Clean architecture in the frontend**: isolate domain logic from framework/UI and from infrastructure (PDF engine, storage, network).[^3]
- **Centralized but modular state** (Pinia) to keep behavior coherent.[^4][^1]

### 1.1. Layers and boundaries

Target structure:

- **Presentation/UI layer (Vue components)**
  - Only deals with user input, rendering, and delegating to application layer.
  - No PDF SDK calls, no business rules.
- **Application layer (use‑cases)**
  - Implements workflows like `importPdf`, `reorderPages`, `updateMetadata`, `applyTool`, `executeCommand`.
  - Orchestrates domain objects and infrastructure.
  - Stateless or thin classes/functions called from Pinia actions.
- **Domain layer**
  - Pure TypeScript: entities (`PdfDocument`, `Page`, `OutlineItem`, `HistoryCommand`), value objects, domain services.
  - No Vue, no HTTP, no PDF SDK.
  - Represents **business rules** (what reordering means, invariants on metadata, constraints on outlines).[^3]
- **Infrastructure layer**
  - PDF SDK wrapper (pdf.js or commercial SDK), persistence, filesystem/Cloud, telemetry.
  - Implements interfaces defined in domain/application (“repositories”).

**Why this structure**

- **Maintainability \& scaling**: Industry case studies on large Vue apps show that feature/domain‑centric, layered architectures reduce coupling and make onboarding and refactors easier as teams grow.[^2][^1][^3]
- **Testability**: Pure domain/application logic is easy to unit test without spinning up Vue or a canvas/PDF engine.[^3]
- **Technology independence**: You can upgrade Vue, swap PDF SDKs, or introduce a native client without rewriting business rules.

---

## 2. Domain and module structure

### 2.1. Domains

Recommended domains for your editor:

- `workspace` – open documents, tabs, layout, theme, keybindings.
- `document` – document identity, pages, metadata, outline tree.
- `editor` – tools, selection, zoom, page viewport, overlays.
- `history` – commands, undo/redo stacks, grouping.
- `export` – exporting, saving, sharing, exporting subsets.

Folder layout (simplified):

```txt
src/
  app/
    App.vue
    router/
    plugins/
    store/              # app-level, very small

  shared/
    components/
    composables/
    utils/
    styles/
    types/

  domains/
    workspace/
      ui/
      store/
      application/
      domain/
      infrastructure/

    document/
      ui/
      store/
      application/
      domain/
      infrastructure/

    editor/
      ui/
      store/
      application/
      domain/
      infrastructure/

    history/
      ui/
      store/
      application/
      domain/
```

**Why group by domain**

- **Feature cohesion**: Developers find all code for “document” features in one place, which improves change locality and reduces accidental coupling.[^1][^2]
- **DDD alignment**: Domain‑oriented directory is explicitly recommended for frontend clean architecture.[^3]

---

## 3. State management and flows (Pinia)

Use **Pinia stores per domain**:

- `useWorkspaceStore`
- `useDocumentStore`
- `useEditorStore`
- `useHistoryStore`

Each store:

- Holds **UI‑relevant state**.
- Exposes **actions** that call application‑layer use‑cases or domain services.
- Avoids direct infrastructure dependencies; call through injected services or module‑level facades.

Example (conceptual):

```ts
// domains/document/store/document.store.ts
export const useDocumentStore = defineStore('document', {
  state: () => ({
    currentDocumentId: null as DocumentId | null,
    pages: [] as Page[],
    metadata: null as PdfMetadata | null,
    outline: [] as OutlineItem[],
  }),
  actions: {
    async loadDocument(file: File) {
      const doc = await documentApp.importPdf(file) // application service
      this.currentDocumentId = doc.id
      this.pages = doc.pages
      this.metadata = doc.metadata
      this.outline = doc.outline
    },
    reorderPages(payload: ReorderPagesPayload) {
      const result = documentDomain.reorderPages(this.pages, payload)
      this.pages = result.pages
      this.outline = result.outline // e.g. maintain invariants
    },
  },
})
```

**Why Pinia + domain services**

- Pinia is now recommended as the standard state manager for Vue 3 and offers simple modular stores and great TS support.[^5][^6][^7][^8]
- Keeping domain rules outside stores avoids “God‑store” syndrome and makes it easier to share logic (e.g. in tests or Node scripts).

---

## 4. History and undo/redo (Command pattern)

Your editor needs **deep, structured history**. There are two main strategies:

- **State‑based (memento)** – store snapshots of state over time.
- **Action‑based (command)** – store operations that can execute/undo.[^9][^10]

For a PDF editor with potentially large documents and many operations, the **Command pattern** is preferable:

- Commands carry just enough data to undo/redo.
- You can group commands (e.g. “drag multiple pages”) and handle side effects (thumbnails, selection) in one place.[^11][^9]

### 4.1. Command model

```ts
export interface Command {
  readonly id: string
  readonly label: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
}
```

Concrete commands:

- `ReorderPagesCommand`
- `UpdateMetadataCommand`
- `ChangeOutlineCommand`
- `ApplyToolCommand` (might encapsulate a batch of changes).

History store:

```ts
export const useHistoryStore = defineStore('history', {
  state: () => ({
    undoStack: [] as Command[],
    redoStack: [] as Command[],
  }),
  getters: {
    canUndo: (s) => s.undoStack.length > 0,
    canRedo: (s) => s.redoStack.length > 0,
  },
  actions: {
    async executeCommand(cmd: Command) {
      await cmd.execute()
      this.undoStack.push(cmd)
      this.redoStack = []
    },
    async undo() {
      const cmd = this.undoStack.pop()
      if (!cmd) return
      await cmd.undo()
      this.redoStack.push(cmd)
    },
    async redo() {
      const cmd = this.redoStack.pop()
      if (!cmd) return
      await cmd.execute()
      this.undoStack.push(cmd)
    },
  },
})
```

**Why this approach**

- Articles on undo/redo for complex web apps show that **command‑based systems give better decomposition, local reasoning, and testability** than global state snapshots when operations become diverse and cross‑cut multiple parts of state.[^11][^9]
- Command pattern allows each component or domain to **define its own commands** while still plugging into a centralized history manager, which is specifically cited as an advantage in undo/redo literature.[^10][^11]
- For PDF SDKs that already expose history, you can wrap their internal history operations into your commands, preserving consistent UX while decoupling UI from the SDK.[^12]

---

## 5. Types, constants, and enums

### 5.1. Domain types

Keep domain types in `domains/*/domain/types.ts`, independent of Vue:

```ts
export type DocumentId = string & { readonly brand: unique symbol }

export interface Page {
  readonly id: string
  index: number
  width: number
  height: number
  rotation: Rotation
}

export interface PdfMetadata {
  title: string
  author: string
  subject?: string
  keywords?: string[]
  createdAt?: Date
  modifiedAt?: Date
}

export interface OutlineItem {
  id: string
  title: string
  targetPageId: string
  children: OutlineItem[]
}
```

**Why this separation**

- Clean architecture guidance explicitly says the **domain directory should contain shared types, enums, and constants** referenced across the domain model, and stay free of framework dependencies.[^3]
- It centralizes business language and avoids leaks of UI concerns into core logic.

### 5.2. Constants vs enums

For fixed sets like tools, panel types, and keyboard commands, you want **type‑safe constants**.

You have two main options:

1. **TypeScript enums**
2. **const objects + literal unions**

Recent TypeScript best‑practice articles recommend **const objects + `as const`** for many frontend cases because they are tree‑shakeable and introduce no extra runtime objects, while still giving literal types.[^13]

Example:

```ts
export const TOOL = {
  MOVE: 'move',
  SELECT: 'select',
  TEXT: 'text',
  HIGHLIGHT: 'highlight',
} as const

export type Tool = (typeof TOOL)[keyof typeof TOOL]
```

**Why prefer `as const` constants**

- Enums compile to runtime objects with lookups and can introduce overhead and bundling quirks, while `as const` objects are just plain JS values and preserve literal types.[^13]
- Guidance: use enums for tightly structured sets where their semantics are valuable; otherwise constants are more flexible and efficient.[^13]

Use enums sparingly where they truly add clarity, e.g. for `HistoryGroupType` or `DocumentStatus`.

### 5.3. Global constants

Create a shared constants module for **cross‑domain, non‑business values**:

```ts
// shared/constants/keymap.ts
export const KEY = {
  UNDO: 'Ctrl+Z',
  REDO: 'Ctrl+Shift+Z',
  SAVE: 'Ctrl+S',
} as const
```

**Why isolate constants**

- Clean code practice: **magic strings/numbers** scattered through components make maintenance difficult; centralizing them improves readability and reduces errors.[^14][^13]

---

## 6. Clean code \& clean architecture practices

### 6.1. Component-level practices

Best‑practice guides for Vue emphasize:[^4][^14][^1]

- **Small, focused components**: each component should have a single responsibility (e.g. `PageList`, `OutlineTree`, `MetadataForm`).
- **Base components** for cross‑app primitives (buttons, panels, modals) in `shared/components/base`.
- **Container vs presentational**:
  - Container components connect to stores and coordinate actions.
  - Presentational components only receive props and emit events.

Why:

- Smaller components are easier to test and reason about, and consistent split between container/presentational improves reuse and reduces duplication.[^1][^4]

### 6.2. Composition API and composables

Use **Composition API** and **composables** instead of mixins:

- `useKeymap`
- `useToolMode`
- `useSelection`
- `useZoom`
- `useDocumentTabs`

Reasons:

- Composition API + composables are the recommended way to share logic in Vue 3 and avoid the name‑collision and implicit behavior problems of mixins.[^4]
- Clean separation of concerns: composables encapsulate logic, components focus on rendering and wiring.

### 6.3. Dependency direction and boundaries

Enforce these rules (Clean Architecture applied to frontend):

- `ui` → can import from `application` and `domain`, never from `infrastructure`.
- `application` → can import from `domain` and talk to `infrastructure` via interfaces.
- `domain` → pure; no imports from Vue, Pinia, or concrete SDKs.
- `infrastructure` → imports domain interfaces and implements them.

Frontend clean‑architecture resources stress strongly that **dependencies must point inward to the domain**, not outward, to keep business logic stable over time.[^2][^3]

---

## 7. Evidence and “proofs” for these choices

Here’s how the key decisions map to external evidence and experience:

| Decision                                                                    | Evidence / Rationale                                                                                                                                                                                           |
| :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain‑based, layered structure                                             | Guides on large‑scale Vue apps show that grouping by feature/domain improves maintainability, scalability, and collaboration compared to type‑based structures, especially as codebases grow.[^1][^2][^3]      |
| Separation of domain/application/infrastructure                             | Frontend DDD articles explicitly recommend putting entities, types, enums, and domain services in a dedicated domain layer, which leads to better testability and reduced coupling.[^3]                        |
| Use Pinia stores per domain                                                 | Pinia is recommended as the standard state manager for Vue 3; articles highlight its modularity, TS support, and better DX for large apps.[^5][^6][^7][^8]                                                     |
| Command pattern for history                                                 | Undo/redo articles show that while snapshot‑based approaches are simple, command‑based systems scale better for complex operations and allow local, per‑feature definitions of undoable actions.[^11][^9][^10] |
| `as const` constants vs enums                                               | TS experts note that enums create runtime objects and overhead, whereas `as const` literals give type safety with zero extra runtime behavior, making them a better default in many frontend scenarios.[^13]   |
| Composition API \& composables                                              | Modern Vue best‑practice articles recommend Composition API and composables for logic reuse, type‑safety, and maintainability over mixins and large Options components.[^4]                                    |
| Clean code practices (small components, no magic values, consistent naming) | Clean‑code‑for‑frontend guidance ties readability, maintainability, and defect reduction directly to clear naming, small units, and removal of duplication/magic constants.[^4][^14]                           |

---

[^1]: https://enterprisevue.dev/blog/structuring-large-scale-vue-apps/

[^2]: https://feature-sliced.design/blog/vue-application-architecture

[^3]: https://dev.to/blindpupil/domain-driven-architecture-in-the-frontend-i-1f41

[^4]: https://cloudinary.com/guides/web-performance/vue-best-practices

[^5]: https://www.zignuts.com/blog/vue3-state-management-with-pinia

[^6]: https://www.daydreamsoft.com/blog/pinia-as-the-standard-for-state-management-in-modern-vue-applications

[^7]: https://blog.logrocket.com/complex-vue-3-state-management-pinia/

[^8]: https://tighten.com/insights/state-management-in-vue-3-why-you-should-try-out-pinia/

[^9]: https://dev.to/npbee/command-based-undo-for-js-apps-34d6

[^10]: https://engineering.contentsquare.com/2023/history-undo-redo/

[^11]: https://www.esveo.com/en/blog/undo-redo-and-the-command-pattern/

[^12]: https://www.compdf.com/guides/pdf-sdk/web/content-editor/undo-and-redo

[^13]: https://blog.logrocket.com/typescript-enums-vs-types/

[^14]: https://techtose.com/latest-insights/clean-code-practices-for-frontend-development

[^15]: https://www.reddit.com/r/vuejs/comments/1ay0rui/best_practices_for_organizing_larger_vue_3/

For your PDF editor, treat “mobile support” as a UX/architecture decision first, and a technical decision second.

### 1. When to make components responsive

Use **responsive components (same component, CSS + layout variants)** when:

- The **core interaction is the same** on desktop and mobile (e.g. viewing pages, basic zoom, selecting a page).
- You want to **reuse logic and markup** and only change layout (stack vs columns, bigger touch targets, hidden panels).
- You can achieve the differences with:
  - CSS grid/flex + media queries.
  - Utility frameworks (Tailwind, etc.) with breakpoints.
  - A small `useBreakpoint()`/`isMobile` composable to switch classes/slots.

This is usually the default for things like:

- Page list, outline tree, metadata panel.
- Common layout: sidebars collapse, panels stack vertically.

Why this is preferred in most cases:

- You avoid **duplicated logic and bugs** between “DesktopPageList.vue” and “MobilePageList.vue”.
- Modern responsive design practice strongly favors a **single responsive component** unless the UX is fundamentally different, because it reduces maintenance and improves consistency. Responsive CSS and breakpoints are mature, well‑understood, and widely used for this reason. [moldstud](https://moldstud.com/articles/p-best-practices-for-responsive-design-in-vuejs-ensuring-browser-compatibility)

Example pattern:

```ts
// shared/composables/useBreakpoint.ts
export function useBreakpoint() {
  const width = ref(window.innerWidth)
  const isMobile = computed(() => width.value < 768)
  // listen to resize…

  return { isMobile }
}
```

```vue
<!-- PageList.vue -->
<template>
  <div :class="isMobile ? 'page-list--mobile' : 'page-list--desktop'">
    <!-- same core markup, different layout classes -->
  </div>
</template>
<script setup lang="ts">
const { isMobile } = useBreakpoint()
</script>
```

CSS:

```css
.page-list--desktop {
  display: flex;
  flex-direction: column;
}
@media (max-width: 768px) {
  .page-list--mobile {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
```

This follows the typical “media queries + responsive units + flex/grid” guidance. [moldstud](https://moldstud.com/articles/p-best-practices-for-responsive-design-in-vuejs-optimizing-component-layouts)

---

### 2. When to create separate mobile components

Create **separate mobile components/screens** when:

- The **interaction model is different**, not just the layout.
  - Example: desktop shows a full VS Code‑style 3‑pane layout; mobile shows a **single main view** with a bottom tab bar (Pages / Outline / Edit / Info).
- You hide or **reorder major flows** on mobile to simplify the experience (e.g. metadata editing becomes its own full‑screen flow).
- You would otherwise need an explosion of `v-if="isMobile"` branching in a single component, making it hard to read and test.

In that case:

- Keep **shared logic** in composables and stores.
- Have separate **container components**:

```txt
WorkspaceDesktop.vue
WorkspaceMobile.vue
```

Select them at the route level based on breakpoint:

```vue
<template>
  <WorkspaceDesktop v-if="!isMobile" />
  <WorkspaceMobile v-else />
</template>
<script setup lang="ts">
const { isMobile } = useBreakpoint()
</script>
```

Inside, both use the same stores (`useDocumentStore`, `useEditorStore`, `useHistoryStore`) and composables. Only the **layout and navigation metaphor** differ.

Why this is justified:

- Responsive design guides acknowledge that for some products, mobile wants a **different flow**, not just different CSS; in those cases separate views provide better clarity and avoid over‑complex components. [reddit](https://www.reddit.com/r/vuejs/comments/zy8vyq/how_easy_is_it_to_make_responsive_vue2_or_vue3/)
- This matches how many real apps treat mobile vs desktop: same domain, different shells around it.

---

### 3. What I’d recommend for your specific app

For a VS Code‑style PDF editor with rich tools:

1. **Shared domain & logic**
   - All document/edit/history logic is shared via domain layer + composables + stores.
   - No mobile/desktop divergence here.

2. **Two shell layouts, one codebase**
   - **Desktop workspace**: VS Code layout (left sidebar, center editor, right panel, status bar).
   - **Mobile workspace**: single central editor, with:
     - Bottom tab bar (Pages, Outline, Edit, Info, History).
     - Overlays/slide‑in panels instead of sidebars.
   - Implemented as separate route‑level components (`WorkspaceDesktop`, `WorkspaceMobile`) selected via breakpoint.

3. **Responsive components inside each layout**
   - Within each shell, components like `PageList`, `OutlineTree`, `MetadataForm` are responsive but **not duplicated**.
   - Use CSS + breakpoints + `isMobile` for finer layout tweaks.

Reasoning:

- This hybrid keeps **behavior DRY** (no duplicated business logic or stores) while letting you optimize UX for touch vs mouse.
- The approach aligns with mainstream responsive‑Vue advice (CSS + breakpoints + optional JS breakpoint composables) and with experience that mobile often needs a different **shell** but can share most internals. [reddit](https://www.reddit.com/r/vuejs/comments/ggo62d/how_to_switch_design_on_mobile_screens/)

---

### 4. Clean‑architecture angle

From a clean architecture perspective:

- Mobile vs desktop differences belong mostly to the **UI shell layer**.
- Domain, application, and infrastructure layers remain agnostic to screen size.
- Your types, constants (tools, keybindings, commands), and history model are identical; only **presentation** decides which subset to expose and how to arrange it.

That means you don’t fragment your architecture by device; you just provide multiple “presentations” of the same core system, which is exactly what clean architecture is designed for.
