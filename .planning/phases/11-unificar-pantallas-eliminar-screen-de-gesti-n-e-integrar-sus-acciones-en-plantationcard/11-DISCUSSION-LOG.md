# Phase 11: Unificar pantallas — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 11-unificar-pantallas-eliminar-screen-de-gestion-e-integrar-sus-acciones-en-plantationcard
**Areas discussed:** Card action icons, Admin actions menu, Create plantation entry, Navigation cleanup

---

## Card Action Icons

### Icon placement on PlantationCard

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right corner | Edit + gear icons next to title row | |
| Bottom action bar | Row of icon buttons at bottom of card | |
| Replace sidebar icons | Stacked icons in colored sidebar | |
| Right sidebar strip | Edit (top), gear (middle), trash (bottom) in right column | ✓ |

**User's choice:** Right sidebar strip (user-proposed alternative)
**Notes:** User specifically wanted trash icon included in the layout, not just edit/gear. Proposed extending the existing delete button column into a 3-icon vertical strip.

### Edit icon visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Both roles | Admin and tecnico can edit lugar/periodo | ✓ |
| Admin only | Only admin sees the edit icon | |

**User's choice:** Both roles
**Notes:** Matches phase goal description "accesible a todos los roles".

### Tecnico sidebar layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stack tightly | Edit and trash spaced evenly, no gap | |
| Keep gap | Same 3-slot layout with empty middle slot | ✓ |

**User's choice:** Keep gap — consistent card height across roles.

---

## Admin Actions Menu

### What opens on gear tap

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom sheet | Slide-up modal with action list | ✓ |
| Modal centered | Centered dialog with actions | |
| Inline expand | Card expands downward (accordion) | |

**User's choice:** Bottom sheet

### Disabled action visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Show disabled + helper | Grey out with explanation text | ✓ |
| Hide unavailable | Only show performable actions | |

**User's choice:** Show disabled with helper text

### Bottom sheet implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Modal | Reuse existing Modal pattern, slide-up animation | ✓ |
| @gorhom/bottom-sheet | Full library with gestures, snap points | |

**User's choice:** Custom Modal for now
**Notes:** User expressed interest in @gorhom/bottom-sheet for future features (photo gallery, swipeable content) but agreed the simpler approach is better for this use case. Noted as deferred idea.

---

## Create Plantation Entry Point

### Where the "+" button goes

| Option | Description | Selected |
|--------|-------------|----------|
| Header, next to catalog | Two buttons in header right area | ✓ |
| FAB | Floating action button, bottom-right | |
| Inside bottom sheet | Action in a general menu | |

**User's choice:** Header next to catalog icon. Admin sees [+][⬇], tecnico sees only [⬇].

---

## Navigation Cleanup

### Tab layout after removing Gestión

| Option | Description | Selected |
|--------|-------------|----------|
| Identical to tecnico | 2 tabs: Plantaciones, Perfil | ✓ |
| Maintain difference | Add extra tab/element for admin | |

**User's choice:** Identical layouts — differentiation is purely in content.

---

## Claude's Discretion

- Bottom sheet component details (animation, backdrop, dismiss)
- Hook restructuring strategy (split/merge usePlantationAdmin)
- AdminPlantationModals adaptation approach

## Deferred Ideas

- @gorhom/bottom-sheet library for advanced use cases (photo gallery, swipeable UI)
- Unify admin/tecnico _layout.tsx into single shared layout
