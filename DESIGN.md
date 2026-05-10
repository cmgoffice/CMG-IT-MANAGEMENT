# Design System Strategy: The CMG IT Management

## 1. Overview & Creative North Star
**Creative North Star: "The CMG IT Management"**
The objective of this design system is to transform the typically sterile, utilitarian nature of IT asset management into a "High-End Editorial" experience. We are moving away from the "cluttered dashboard" trope and toward a layout that feels like a premium architectural journal. 

By leveraging **Soft Minimalism**, we utilize intentional asymmetry—where large, airy headlines are juxtaposed against dense, precise data blocks—to create a sense of organized calm. We break the "template" look by treating the interface not as a flat grid, but as a series of curated, floating planes of information. The result is a landing page that feels authoritative yet approachable, ensuring that complex data like asset registration and history logs feel effortless to navigate.

---

## 2. Colors
The color palette is built on a sophisticated two-tone pastel blue and white foundation, utilizing tonal depth rather than high-contrast borders to define space.

- **Primary & Secondary Roles:** Use `primary` (#27619D) for high-impact actions. The `primary_fixed` (#86B9FB) and `secondary_fixed` (#C7E7FF) act as the "Pastel Soul" of the system, used for large background washes or decorative accents.
- **The "No-Line" Rule:** To maintain a premium feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined through background shifts. For example, a main content area using `surface_container_low` (#F0F4F7) should sit directly against the `surface` (#F7F9FB) background.
- **Surface Hierarchy & Nesting:** Treat the UI as physical layers. 
    - Base layer: `background` (#F7F9FB).
    - Sectional containers: `surface_container` (#EAEFF2).
    - Floating interactive cards: `surface_container_lowest` (#FFFFFF).
- **The "Glass & Gradient" Rule:** For the IT Department’s hero section or "Live Status" widgets, use Glassmorphism. Apply `surface_container_lowest` with 70% opacity and a 20px backdrop-blur. 
- **Signature Textures:** Use subtle linear gradients for primary CTAs, transitioning from `primary` (#27619D) to `primary_dim` (#155590) at a 135-degree angle to provide a "lit from within" professional polish.

---

## 3. Typography
We utilize a pairing of **Manrope** and **Inter** to balance personality with extreme legibility for data-heavy logs.

- **The Display Scale (Manrope):** Use `display-lg` and `headline-lg` for section headers. These should be set with tight letter-spacing (-0.02em) to evoke a modern, editorial feel. 
- **The Data Scale (Inter):** All asset logs, registration forms, and history tables must use the Inter scale. 
    - `title-sm` (#1.0rem) for table headers.
    - `body-md` (#0.875rem) for primary data entries.
    - `label-sm` (#0.6875rem) in `on_surface_variant` for metadata (e.g., "Last scanned: 2 hours ago").
- **Intentional Hierarchy:** By sizing headlines significantly larger than body text, we create "entry points" for the eye, preventing the user from feeling overwhelmed by technical logs.

---

## 4. Elevation & Depth
Depth is communicated through **Tonal Layering** and ambient light, rather than structural lines.

- **The Layering Principle:** To highlight an "Asset Entry" card, do not draw a box. Instead, place a `surface_container_lowest` (pure white) card on a `surface_container` background. The subtle 4% difference in luminosity creates a sophisticated, natural lift.
- **Ambient Shadows:** For "floating" elements like modals or tooltips, use a shadow with a 40px to 60px blur, set at 6% opacity. The shadow color must be a tinted version of `on_surface` (#2C3437), creating a soft, blue-grey atmospheric effect rather than a harsh black drop shadow.
- **The "Ghost Border" Fallback:** If a border is required for accessibility in data tables, use the `outline_variant` (#ACB3B7) at **15% opacity**. It should be felt, not seen.
- **Glassmorphism:** Use for persistent navigation bars. A background of `surface_container_lowest` at 80% opacity with a blur effect allows the pastel blues of the content to bleed through, softening the interface.

---

## 5. Components

### Buttons
- **Primary:** Background `primary`, text `on_primary`. Apply `lg` (1rem) roundedness. No shadow on rest; a 4px `primary_container` glow on hover.
- **Tertiary (Ghost):** No background or border. Text in `primary`. Use for "Cancel" or "View Less" actions to maintain a clean layout.

### Input Fields (Asset Registration)
- **Styling:** Use `surface_container_highest` for the input fill. 
- **State:** On focus, the background transitions to `surface_container_lowest` with a 2px "Ghost Border" of `primary`.
- **Labels:** Use `label-md` floating above the input, never inside, to ensure high scanability for data entry.

### Cards & Tables (History Logs)
- **Forbidden:** Never use horizontal divider lines.
- **Structure:** Separate history log entries using vertical whitespace (24px) or a subtle hover state shift to `surface_container_low`. 
- **Asymmetric Data:** Align primary asset IDs to the left in `title-sm` (Manrope) and metadata to the right in `label-sm` (Inter) to create a high-end "receipt" aesthetic.

### Chips (Status Indicators)
- **Design:** Use `secondary_container` for neutral statuses and `error_container` for alerts. All chips must use `full` roundedness (pills) and `label-sm` typography.

---

## 6. Do's and Don'ts

### Do
- **Do** use large amounts of "white space" (specifically using `surface` colors) to let the data breathe.
- **Do** overlap elements slightly (e.g., a search bar overlapping a hero image) to break the "boxed-in" feeling.
- **Do** use `primary_fixed` for subtle background washes behind complex data tables to reduce cognitive load.

### Don't
- **Don't** use 100% black text. Always use `on_surface` (#2C3437) for a softer, premium contrast.
- **Don't** use "Standard Blue." Stick strictly to the pastel and deep indigo tones provided in the tokens.
- **Don't** use sharp corners. Every interactive element must adhere to the `md` (0.75rem) or `lg` (1rem) roundedness scale to maintain the "friendly" professional vibe.
- **Don't** use "Zebra Striping" for tables. Use subtle tonal shifts or just whitespace to distinguish rows.
