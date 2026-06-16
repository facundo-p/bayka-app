---
name: safe-area-screens
description: Enforce safe-area insets on Bayka screens and full-screen modals (Android). Use when creating or reviewing any new screen, RN Modal, or component with its own header/footer/action bar, or when content looks pegged to the status bar / nav bar. Prevents the recurring "header glued to the notification bar" bug.
---

# Safe-area en pantallas y modales (Bayka, Android)

App Android-only (Expo / RN). Los `Modal` de RN y las pantallas full-screen **no
heredan los insets** del SO: el contenido arranca en `y=0`, debajo de la status
bar, y termina debajo de la barra de navegación. Hay que aplicarlos a mano.

## Regla

Todo **header propio** (no `CustomHeader`) y toda **barra de acciones inferior**
dentro de un `Modal` full-screen o pantalla sin chrome debe aplicar el inset
correspondiente con `useSafeAreaInsets()`.

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

const insets = useSafeAreaInsets();
// Header propio:
<View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>…</View>
// Barra de acciones que toca el borde inferior:
<View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>…</View>
```

## Qué NO hacer

- ❌ Hardcodear `top: 50` / paddings mágicos para "esquivar" la status bar
  (rompe en notch / alturas distintas). Siempre `insets.top`.
- ❌ Asumir que un `Modal presentationStyle="pageSheet"` respeta el inset: en
  Android va full-screen y arranca en `y=0`.

## Cubierto vs no cubierto

- ✅ Pantallas con `CustomHeader` → ya aplica `insets.top`.
- ⚠️ **Modales con header a mano** (`TreeDetailModal`, `TreeListModal`, …) →
  hay que aplicar el inset explícitamente. Acá aparece el bug.

## Checklist al crear/revisar una pantalla o modal

1. ¿Tiene header propio (no `CustomHeader`)? → ¿`paddingTop: insets.top + …`?
2. ¿Tiene botones/acciones pegados al borde inferior? → ¿`paddingBottom:
   insets.bottom + …`?
3. ¿Usa `top:`/`bottom:` numéricos para evitar las barras? → reemplazar por insets.
4. Verificar en device real (la barra de estado del SO no debe tapar el título).

Ver también `tasks/lessons.md` → "Safe-area en headers de modales/pantallas
full-screen" y la memoria `feedback_safearea_audit_by_presentation`.
