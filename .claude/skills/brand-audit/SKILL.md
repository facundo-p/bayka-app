---
name: brand-audit
description: Audit and enforce Bayka brand identity — fonts (Poppins, Comfortaa), logo usage, and brand colors from bayka.com.ar. Use when reviewing UI code, creating new screens, or checking brand compliance.
argument-hint: "[file-or-directory]"
---

# Bayka Brand Identity Standard

This skill defines the official brand identity for the Bayka mobile app, derived from [bayka.com.ar](https://bayka.com.ar/).

## Fonts

The app uses two font families, loaded via `@expo-google-fonts` in `app/_layout.tsx`:

| Font | Role | Variants loaded |
|------|------|-----------------|
| **Poppins** | Primary body font — all body text, labels, buttons, inputs, captions | Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700) |
| **Comfortaa** | Display/heading font — screen titles, section headings, hero text | Regular (400), SemiBold (600), Bold (700) |

### Usage rules

- **Every visible `<Text>` must have an explicit `fontFamily`** from `src/theme.ts > fonts`.
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

## Logo

Two versions available in `mobile/assets/`:

| File | Description | Use when |
|------|-------------|----------|
| `logo-bayka.png` | Dark blue (#1b3a5c) carpincho silhouette + "BAYKA" text | Light backgrounds (login, splash, headers) |
| `logo-bayka-white.png` | White version, transparent background | Dark backgrounds (dark headers, overlays) |

### Logo rules

- Always use `require('../assets/logo-bayka.png')` — never hotlink to the website.
- Maintain aspect ratio (`resizeMode: 'contain'`).
- Minimum clear space around the logo: 16px.
- Never distort, recolor, or add effects to the logo.

## Brand colors (from bayka.com.ar)

The website defines these brand colors:

| Token | Hex | Role |
|-------|-----|------|
| Primary blue | `#0d6efd` | Web primary — NOT used in mobile app |
| Secondary blue | `#0654c4` | Web secondary — NOT used in mobile app |

The mobile app uses its own green-based palette defined in `src/theme.ts > colors`. The web blues are documented here for reference only — do not introduce them into the mobile app.

## Audit procedure

When auditing $ARGUMENTS (or the full app if no argument given):

1. **Find all `<Text>` elements** in the target files.
2. **Check each has `fontFamily`** set via `fonts.*` from theme. Flag any that:
   - Have no `fontFamily` (will render in system default).
   - Use raw strings instead of the `fonts` import.
   - Use `fontWeight: 'bold'` without a corresponding bold font variant.
3. **Check headings** — screen titles and section headers should use `fonts.heading*`, not `fonts.bold`.
4. **Check logo usage** — if any screen references a logo, verify it uses the asset files, not a URL.
5. **Check imports** — every file using fonts must import `{ fonts }` from theme, not the raw font names.

### Output format

For each file audited, report:

```
## filename.tsx
- [PASS|FAIL] Font coverage: X/Y Text elements have fontFamily
- [PASS|FAIL] Font imports: uses fonts.* from theme (not raw strings)
- [PASS|FAIL] Heading fonts: headings use Comfortaa variants
- [PASS|FAIL] Logo usage: correct asset references
- [PASS|FAIL] No bare fontWeight without fontFamily
```

End with a summary: total files, pass rate, and a list of fixes to apply.

When invoked without `$ARGUMENTS`, audit all files in `mobile/src/screens/` and `mobile/src/components/`.
