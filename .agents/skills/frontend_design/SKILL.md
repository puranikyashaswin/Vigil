---
name: frontend_design
description: "Use when designing, building, or styling the Next.js frontend interfaces, components, layout, or animations"
---

# Frontend Design Skill

This skill defines the visual identity, styling rules, typography, animation principles, and interactive components (like the 2D knowledge graph) for Vigil's Next.js frontend.

---

## 1. Aesthetic Identity & Theme

Vigil uses a modern Zinc-based light/dark theme managed via a `next-themes` toggle. The layout adjusts between light mode (ivory base with zinc accents) and dark mode (dark charcoal canvas).

### Color Palette (Zinc System)
- **Background**: Zinc light (`bg-zinc-50`) and Zinc dark (`bg-zinc-950`). 
- **Borders / Chrome**: Light borders (`border-zinc-200`) and dark borders (`border-zinc-800`).
- **Text**: Zinc dark text (`text-zinc-900` / `text-zinc-800`) and zinc light text (`text-zinc-100` / `text-zinc-200`). Muted text uses `text-zinc-500` or `text-zinc-400`.
- **Accents**:
  - Orange / Clay (`#d97757`): Accent for active selections, borders, and main buttons.
  - Blue (`#6a9bcc`): Accent for concept/equipment nodes and metadata links.
  - Green (`#788c5d`): Accent for procedure nodes.
  - Crimson (`#EF4444`): Alert-specific accent (critical badges, warning borders).
- **Branding**: Standard clean rounding (`rounded-lg` for panels/buttons, `rounded-full` for the chat input capsule).

### Contrast & Readability
- All text elements must maintain a minimum contrast ratio of 4.5:1 against the active background theme, conforming to WCAG AA standards.

### Typography
- **Headings**: Monospace (`font-mono`), bold, uppercase, tracking-tight or tracking-wide.
- **Body & Labels**: Monospace for metadata, file paths, and terminal-style labels; clean sans-serif (`font-sans`) for body prose and descriptions.
- **Font Sizes**: Use `text-[10px]` to `text-xs` for chrome and metadata; `text-sm` for body; `text-lg` to `text-xl` for headings.

### Spacing Philosophy
- Grid-based strict spacing (`gap-4`, `gap-6`). Panels use border dividers (`border-zinc-200` / `border-zinc-800`).

---

## 2. 2D Knowledge Graph Integration (`react-force-graph-2d`)

The interactive 2D knowledge graph visualizes the cross-linked OKF concept network using an Obsidian-style force layout. It is built with `react-force-graph-2d` (NOT 3D).

### Layout Integration
- **Split-Screen View**: The 2D canvas occupies the left 60% of the viewport (40% on the right for the inspector/alerts panel).
- **Canvas Container**: The `ForceGraph2D` component fills its parent container, using a `useEffect` resize observer to match container dimensions.
- **Chat Input Bar**: Relocated from the right panel to a floating, centered input bar positioned at the bottom of the graph panel (left 60%). Clicking the history button in this bar triggers a full-screen chat overlay.

### Node Rendering
- **Node Style & Shapes**: Rendered via `nodeCanvasObject` on an HTML5 canvas based on type classifications:
  - **Equipment / Concept / Drawing / Event / Organization**: Solid rectangles with inner mono-spaced tag text.
  - **Regulation**: Hexagon outlines (with low-opacity faint fill).
  - **Procedure / Maintenance**: File-tab shapes (representing documents).
  - **Alert (Fallback)**: Solid circles.
- **Color Coding by Concept Type**:
  - `concept` / `equipment` / `drawing` / `event` / `organization`: Blue (`#6a9bcc`)
  - `procedure`: Green (`#788c5d`)
  - `regulation`: Orange / Clay (`#d97757`)
  - `maintenance_log`: Mid Gray (`#b0aea5`)
  - `alert`: Crimson (`#EF4444`)
- **Node Sizing**: Nodes scale proportionally by connection count (degree). Base radius is `3.5`, plus `0.9 * degree`. The degree map is computed in a `useMemo` over all links at component mount.
- **Label Rendering**: Node labels are drawn below each node using monospace font. Font size scales inversely with camera zoom: `Math.max(2.4, 9 / globalScale)`. Label visibility is tied to highlight state and zoom level (low-opacity at zoomed-out distances, full-opacity when zoomed in or selected).

### Link Rendering
- **Default State**: Links render as thin, low-opacity lines in light gray (`#e8e6dc` / `#52525b`) at `0.6px` width and `0.22` alpha.
- **Hover Highlighted State**: Links connected to the hovered node render in orange/clay (`#d97757`) at `1.4px` width and `0.85` alpha.

### Hover Highlight Behavior (Obsidian-Style)
- When hovering a node, a highlight set is computed containing the hovered node, all its direct neighbors, and all links connecting them.
- **Highlighted nodes/links**: Render at full opacity.
- **Dimmed nodes/links** (anything not in the highlight set): Render at `0.12` alpha for nodes, `0.08` alpha for labels, and remain low-opacity for links.
- When nothing is hovered, all nodes/links render at default opacity (highlight set is empty, so the `isHighlighted` check passes for everything).

### Selection Behavior
- Clicking a node opens the inspector panel on the right. The selected node gets an orange/clay (`#d97757`) ring (1.8px stroke) drawn around it.
- The canvas auto-centers and zooms to the selected node (`centerAt` + `zoom(2.0, 800)` over 800ms).

### D3 Force Configuration
- **Charge Force**: Repulsion strength `-100` with `distanceMax` of `250`. This pushes nodes apart to reduce label overlap.
- **Link Force**: Distance `60`, strength `0.8`. Spreads connected nodes and maintains structural layout density.
- **Alpha Decay**: `0.012` (slower cooling for a more settled layout).
- **Velocity Decay**: `0.35` (dampened motion).
- **Initial Layout**: Nodes are arranged in a circle (angle-distributed) around the canvas center before the simulation starts. After 1 second, `zoomToFit(400, 100)` is called to frame all nodes.

### Empty State
- When no nodes exist, the graph area displays a centered placeholder with the "Vigil Intelligence Core" badge and text: "Knowledge Graph is currently empty. Ingest active documents to populate nodes and links."

---

## 3. Contradiction-Alert Feed Styling

Alerts generated by the Ingestion Pipeline are styled dynamically based on the YAML frontmatter `severity` field:

| Severity | Background | Border | Badge |
| :--- | :--- | :--- | :--- |
| **critical** | `bg-red-50` | `border-red-200` with subtle red shadow glow | `bg-red-600 text-white animate-pulse` |
| **high** | `bg-orange-50` | `border-orange-200` | `bg-orange-600 text-white` |
| **medium** | `bg-amber-50` | `border-amber-200` | `bg-amber-500 text-black font-semibold` |
| **low** | `bg-[#e8e6dc]/30` | `border-[#e8e6dc]` | `bg-[#b0aea5] text-[#faf9f5]` |

### Interaction:
- Clicking an alert card opens a modal overlay (`bg-black/60`) with the full alert content. The modal uses Framer Motion for enter/exit transitions (`scale: 0.98` to `1`, `y: 10` to `0`).
- The modal header displays the severity badge, title, and a close button.

---

## 4. Animation Guidelines (`framer-motion`)

Animations are minimal and functional. They enhance perceived performance without distraction.

### When to use Framer Motion:
1. **Tab Content Switches**: Inspector, Chat, and Alerts tab panels fade and slide slightly (`opacity` + `y: 5` to `y: 0` over 150ms) to signal content changes.
2. **Alert Card Clicks / Modal**: Fade in backdrop with slight scale-up on the card (`initial: { scale: 0.98, y: 10 }, animate: { scale: 1, y: 0 }`).
3. **Loading Spinners**: Subtle spin animation on refresh icons during data fetches.

### When to remain Static:
- **Alert Cards List**: Cards load with no staggered cascades or row animations.
- **Graph Legend**: Static overlay with no transitions.
- **Header / Sidebar**: No animated reveals; static chrome.

---

## 5. Mobile & Responsive Layout

Field technicians require full dashboard capability on mobile devices.

### Viewport Adaptation:
- **Split-Screen Collapse**: On viewports narrower than `768px`, the 60/40 desktop split collapses. The 2D knowledge graph occupies the top portion; the inspector/chat/alerts panel stacks below it.
- **Flex Direction**: The main workspace uses `flex-col` on mobile (`md:flex-row` on desktop).
- **Chat Input**: Full-width input bar at the bottom of the chat panel, sticky to the form area.
