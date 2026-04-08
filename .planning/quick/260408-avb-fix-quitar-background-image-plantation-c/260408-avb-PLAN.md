---
phase: quick
plan: 260408-avb
type: execute
wave: 1
depends_on: []
files_modified:
  - mobile/src/components/PlantationCard.tsx
autonomous: true
must_haves:
  truths:
    - "PlantationCard no longer shows a background image"
    - "All text in the card is readable against a solid background"
    - "Card uses brand color palette from theme.ts"
  artifacts:
    - path: "mobile/src/components/PlantationCard.tsx"
      provides: "PlantationCard without background image, readable text"
  key_links:
    - from: "mobile/src/components/PlantationCard.tsx"
      to: "mobile/src/theme.ts"
      via: "colors import"
      pattern: "colors\\.(primary|textPrimary|textSecondary|plantation)"
---

<objective>
Remove the background image from PlantationCard and redesign it with a solid background using brand colors, ensuring all text is readable.

Purpose: The card currently uses a dark image background with white text overlay. Removing the image requires switching to a solid-color card with appropriately contrasted text colors from the brand palette.
Output: Updated PlantationCard.tsx with no image dependency and readable text.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@mobile/src/components/PlantationCard.tsx
@mobile/src/theme.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove background image and redesign PlantationCard with solid brand colors</name>
  <files>mobile/src/components/PlantationCard.tsx</files>
  <action>
Refactor PlantationCard to remove the ImageBackground and use a solid-color design:

1. **Remove image imports and assets:**
   - Remove `ImageBackground` from react-native imports
   - Remove `const defaultTexture = require(...)` line

2. **Replace ImageBackground with plain View:**
   - Replace the `<ImageBackground>` wrapper with a plain `<View style={styles.contentArea}>`
   - Remove the dark overlay `<View style={styles.overlay} />`

3. **Set solid background using brand colors:**
   - The card already has `backgroundColor: colors.surface` (white) on the outer card
   - The content area (replacing imageArea) should use `colors.surface` (white) — clean and readable
   - The colored sidebar already provides brand identity via the accent color

4. **Update text colors for readability on white/light background:**
   - `title` color: change from `'#FFFFFF'` to `colors.textHeading` (#0A3760 — brand dark blue)
   - `subtitle` color: change from `'rgba(255,255,255,0.75)'` to `colors.textSecondary` (#475569)
   - `statValue` color: change from `'#FFFFFF'` to `colors.textPrimary` (#1E293B)
   - Stats icons color: change from `"#FFFFFF"` to the semantic stat colors from theme:
     - tree icon: `colors.statTotal` (#64748B)
     - cloud-done icon: `colors.statSynced` (#0A3760)
     - today icon: `colors.statToday` (#8B5CF6)
   - `pendingSyncText` color: change from `'#FFFFFF'` to `colors.textPrimary`
   - Pending sync icon: change from `"#FFFFFF"` to `colors.info` (#2563EB)
   - `pendingSyncRow` backgroundColor: change from `'rgba(255,255,255,0.15)'` to `colors.infoBg` (#EFF6FF)

5. **Remove unused styles:**
   - Delete `imageArea`, `imageStyle`, `overlay` style definitions

6. **Keep unchanged:**
   - Sidebar with accent color and leaf icon (already works well)
   - Card shadow/elevation
   - Layout structure (flexDirection row, borderRadius)
   - All props and component interface

IMPORTANT: All colors must come from theme.ts imports — no hardcoded hex values (per CLAUDE.md rule 8).
  </action>
  <verify>
    <automated>cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign && npx tsc --noEmit --project mobile/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
    - PlantationCard renders without any ImageBackground or image require
    - All text uses theme.ts color tokens (no hardcoded #FFFFFF or rgba values)
    - Title is dark blue (textHeading), subtitle is gray (textSecondary), stats are dark (textPrimary)
    - Card background is solid white (colors.surface)
    - No unused style definitions remain
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- No references to ImageBackground or card-texture-default.jpg in PlantationCard.tsx
- All color values in the file reference colors.* from theme.ts
- grep -c "FFFFFF\|rgba" PlantationCard.tsx returns 0 (no hardcoded white colors)
</verification>

<success_criteria>
PlantationCard displays with a clean solid background, all text is readable using brand colors from theme.ts, and no background image is loaded.
</success_criteria>

<output>
After completion, create `.planning/quick/260408-avb-fix-quitar-background-image-plantation-c/260408-avb-SUMMARY.md`
</output>
