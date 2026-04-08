---
phase: quick-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - mobile/src/screens/PlantacionesScreen.tsx
  - mobile/src/screens/CatalogScreen.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "When no plantations are downloaded, the header with download icon is still visible"
    - "CatalogScreen shows activa/finalizada filter cards above the plantation list"
  artifacts:
    - path: "mobile/src/screens/PlantacionesScreen.tsx"
      provides: "Header always visible even with empty plantation list"
    - path: "mobile/src/screens/CatalogScreen.tsx"
      provides: "FilterCards for activa/finalizada filtering"
  key_links:
    - from: "PlantacionesScreen.tsx"
      to: "ScreenHeader + download button"
      via: "Rendered outside empty-state conditional"
    - from: "CatalogScreen.tsx"
      to: "FilterCards component"
      via: "Estado-based filtering with activeFilter state"
---

<objective>
Fix two UI issues in the plantaciones flow:
1. PlantacionesScreen: When no plantations are downloaded, the empty state hides the entire screen including the header with the download icon. The header must always be visible so users can navigate to the catalog to download plantations.
2. CatalogScreen: Missing activa/finalizada filter cards. Users need to filter server plantations by estado before downloading.

Purpose: Users with no downloaded plantations are stuck with no way to download. Catalog screen lacks filtering that exists elsewhere.
Output: Both screens fixed with proper header visibility and filtering.
</objective>

<context>
@mobile/src/screens/PlantacionesScreen.tsx
@mobile/src/screens/CatalogScreen.tsx
@mobile/src/components/FilterCards.tsx
@mobile/src/components/ScreenHeader.tsx
@mobile/src/components/TexturedBackground.tsx
@mobile/src/queries/catalogQueries.ts (ServerPlantation has `estado` field)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Show header with download icon when no plantations are downloaded</name>
  <files>mobile/src/screens/PlantacionesScreen.tsx</files>
  <action>
Restructure the empty state in PlantacionesScreen so the header (ScreenHeader + download button) is ALWAYS rendered, regardless of whether plantationList is empty.

Current problem (lines 111-119): The early return when `plantationList.length === 0` renders a plain View with no header, hiding the download button entirely.

Fix approach:
- Remove the early return block (lines 111-119)
- Keep the main return structure with TexturedBackground and ScreenHeader always rendered
- When plantationList is empty or null, render the empty state content (icon + text) BELOW the header, INSTEAD of the FlatList and FilterCards
- Use a conditional: if plantationList has items, show FilterCards + FlatList; otherwise show the empty state view (centered vertically in remaining space)
- The empty state should keep the same visual style (Ionicons leaf-outline, "No hay plantaciones disponibles" title, subtitle)
- The ScreenHeader rightElement (download button) must remain functional — it already handles online/offline state

Structure should be:
```
<TexturedBackground>
  <ScreenHeader ... rightElement={download button} />
  {showFreshnessBanner && ...}
  {plantationList && plantationList.length > 0 ? (
    <>
      <FilterCards ... />
      <FlatList ... />
    </>
  ) : (
    <View style={styles.emptyContainer}>
      ...empty state content...
    </View>
  )}
</TexturedBackground>
```

Update emptyContainer style: remove `backgroundColor: colors.background` (TexturedBackground handles it). Keep flex: 1 for centering.
  </action>
  <verify>
    <automated>cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign && npx tsc --noEmit --project mobile/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Header with download icon always visible. Empty state shows below header when no plantations exist. User can tap download icon to navigate to catalog.</done>
</task>

<task type="auto">
  <name>Task 2: Add activa/finalizada filter cards to CatalogScreen</name>
  <files>mobile/src/screens/CatalogScreen.tsx</files>
  <action>
Add FilterCards component to CatalogScreen, filtering catalogItems by estado (activa/finalizada). Follow the exact same pattern used in PlantacionesScreen.

Changes:
1. Add imports: `FilterCards` from `../components/FilterCards` and `Animated, { FadeInDown }` from `react-native-reanimated`
2. Add state: `const [activeFilter, setActiveFilter] = useState<string | null>(null);`
3. Compute estadoCounts from catalogItems (same pattern as PlantacionesScreen):
   ```
   const estadoCounts = { activa: 0, finalizada: 0 };
   catalogItems.forEach((p) => {
     if (estadoCounts[p.estado as keyof typeof estadoCounts] !== undefined) {
       estadoCounts[p.estado as keyof typeof estadoCounts]++;
     }
   });
   ```
4. Define filterConfigs array (same as PlantacionesScreen):
   ```
   const filterConfigs = [
     { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
     { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
   ];
   ```
5. Filter catalogItems for display:
   ```
   const filteredCatalog = catalogItems.filter(
     (p) => !activeFilter || p.estado === activeFilter
   );
   ```
6. In `renderContent()`, right before the FlatList return (inside the final `return` block starting at line 171), add FilterCards wrapped in Animated.View ABOVE the FlatList:
   ```
   return (
     <>
       <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.xl }}>
         <FilterCards
           filters={filterConfigs}
           activeFilter={activeFilter}
           onToggleFilter={(key) => setActiveFilter(prev => prev === key ? null : key)}
         />
       </Animated.View>
       <FlatList
         data={filteredCatalog}
         ...rest stays the same...
       />
     </>
   );
   ```
7. Update the FlatList `data` prop from `catalogItems` to `filteredCatalog`.
8. Reset activeFilter when catalog reloads: add `setActiveFilter(null)` at the start of `loadCatalog()`.

Note: ServerPlantation already has `estado: string` field from catalogQueries.ts, so no data changes needed.
Note: Import `colors.stateActiva` and `colors.stateFinalizada` are already available from theme.ts (used in PlantacionesScreen).
  </action>
  <verify>
    <automated>cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign && npx tsc --noEmit --project mobile/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>CatalogScreen shows activa/finalizada filter cards above the plantation list. Tapping a filter shows only plantations with that estado. Tapping again clears the filter. Counts update based on catalog data.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. PlantacionesScreen: With no local plantations, header + download button visible
3. CatalogScreen: Filter cards visible above plantation list, filtering works
</verification>

<success_criteria>
- Empty PlantacionesScreen shows ScreenHeader with download icon button
- CatalogScreen displays FilterCards with activa/finalizada counts from server data
- Both screens compile without TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260408-anx-fix-header-y-filtros-plantaciones-descar/260408-anx-SUMMARY.md`
</output>
