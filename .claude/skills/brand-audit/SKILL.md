---
name: brand-audit
description: Audit and enforce Bayka brand identity — fonts (Poppins, Linux Biolinum, monospace for IDs), logo usage, and brand colors (navy and olive green). Use when reviewing UI code, creating new screens, or checking brand compliance.
argument-hint: "[file-or-directory]"
---

# Bayka Brand Identity Standard

This skill defines the brand identity of the Bayka apps.

## Fonts

Both apps use the same three roles:

| Role | Mobile (`fonts` in `mobile/src/theme.ts`) | Web (tokens in `web/src/theme/theme.css`) |
|------|-------------------------------------------|-------------------------------------------|
| Body — text, labels, buttons, inputs, captions | **Poppins** 300–700: `fonts.light`, `regular`, `medium`, `semiBold`, `bold` | `--font-body` (Poppins 400–700) |
| Headings — screen titles, section headers, big numbers | **Linux Biolinum**: `fonts.heading` (Bold), `headingMedium` and `headingRegular` (Regular) | `--font-heading` (Linux Biolinum 400/700) |
| Codes, IDs, GPS | System `monospace`: `fonts.monospace` | `--font-mono` (IBM Plex Mono 400/500) |

Mobile loads them with `useFonts` in `mobile/app/_layout.tsx`: Poppins from `@expo-google-fonts/poppins`, Biolinum from `mobile/assets/fonts/LinBiolinum_R.otf` and `LinBiolinum_RB.otf`. Web loads Poppins and IBM Plex Mono via `@fontsource` in `web/src/main.tsx`, and Biolinum with `@font-face` in `theme.css`.

### Mobile usage rules

- **Every visible `<Text>` must have an explicit `fontFamily`** from `mobile/src/theme.ts > fonts`.
- Never use `fontWeight: 'bold'` alone — use the appropriate font variant instead (e.g., `fonts.bold` instead of `fontWeight: 'bold'`).
- Never use raw font name strings like `'Poppins_400Regular'` — always import from `fonts`.
- Mapping:
  - Body text, labels, descriptions: `fonts.regular`
  - Emphasized body text, button labels: `fonts.medium` or `fonts.semiBold`
  - Strong emphasis, important values: `fonts.bold`
  - Subtle/secondary text: `fonts.light`
  - Screen titles, section headers: `fonts.heading`
  - Smaller headings, card titles: `fonts.headingMedium`
  - Soft display text: `fonts.headingRegular`
  - Codes and IDs: `fonts.monospace`

### Web usage rules

- Every `font-family` in `web/src/**/*.css` uses `var(--font-body)`, `var(--font-heading)` or `var(--font-mono)` (or `inherit`). Only `theme.css` names the fonts.
- The PDFs (`web/src/pdf/`) load the same three families through `FUENTE_PDF`, not CSS tokens.

## Logo

Two versions, the same files in `mobile/assets/` and `web/public/`:

| File | Description | Use when |
|------|-------------|----------|
| `logo-bayka.png` | Dark blue (≈`#16395F`) carpincho silhouette + "BAYKA" text, white background | Light backgrounds (login, splash, headers) |
| `logo-bayka-white.png` | White version, transparent background | Dark backgrounds (dark headers, overlays) |

### Logo rules

- Mobile: `require` the file from `mobile/assets/` (`require('../../assets/logo-bayka.png')` from `src/screens/`).
- Web: `<img src="/logo-bayka.png">`, served from `web/public/`; the PDFs take it from `web/src/pdf/plantilla/recursosNavegador.ts`.
- Never hotlink to the website.
- Maintain aspect ratio (`resizeMode: 'contain'`).
- Minimum clear space around the logo: 16px.
- Never distort, recolor, or add effects to the logo.

## Brand colors

Both apps share the same brand palette:

| Role | Hex | Mobile (`colors` in `mobile/src/theme.ts`) | Web (`web/src/theme/theme.css`) |
|------|-----|--------------------------------------------|---------------------------------|
| Primary — navy | `#0A3760` | `colors.primary`, `headerBg` | `--color-primary`, `--color-text-heading` |
| Secondary — olive green | `#99B95B` | `colors.secondary`, `plantation` | `--color-secondary` |

The tints are each app's own (`primaryBg`, `plantationDark`… in mobile; `--color-primary-bg`, `--color-plantation-dark`… in web) and same-named ones may differ in value. Use the tokens, never the hex.

The bayka.com.ar site uses other blues (`#0d6efd`, `#0654c4`). They are not part of the apps' palette — do not introduce them.

## Audit procedure

When auditing $ARGUMENTS (or the full app if no argument given):

1. **Find all `<Text>` elements** in the target files.
2. **Check each has `fontFamily`** set via `fonts.*` from theme (styles live in the sibling `.styles.ts`). Flag any that:
   - Have no `fontFamily` (will render in system default).
   - Use raw strings instead of the `fonts` import.
   - Use `fontWeight: 'bold'` without a corresponding bold font variant.
3. **Check headings** — screen titles and section headers should use `fonts.heading*` (Linux Biolinum), not `fonts.bold`.
4. **Check logo usage** — if any screen references a logo, verify it uses the asset files, not a URL.
5. **Check imports** — every file using fonts must import `{ fonts }` from theme, not the raw font names.
6. **Web files** — flag any `font-family` in `web/src/**/*.css` other than theme.css that is not a `--font-*` token or `inherit`, and any heading that does not use `--font-heading`.

### Output format

For each file audited, report:

```
## filename.tsx
- [PASS|FAIL] Font coverage: X/Y Text elements have fontFamily
- [PASS|FAIL] Font imports: uses fonts.* from theme (not raw strings)
- [PASS|FAIL] Heading fonts: headings use Linux Biolinum (fonts.heading* / --font-heading)
- [PASS|FAIL] Logo usage: correct asset references
- [PASS|FAIL] No bare fontWeight without fontFamily
```

End with a summary: total files, pass rate, and a list of fixes to apply.

When invoked without `$ARGUMENTS`, audit all files in `mobile/src/screens/` and `mobile/src/components/`. Pass `web/src/` to audit the web.
