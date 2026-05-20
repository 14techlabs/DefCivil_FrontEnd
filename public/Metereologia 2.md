# Design System Specification: The Sentinel Protocol

## 1. Overview & Creative North Star: "The Digital Sentinel"
The design system for this platform departs from the "bureaucratic template" typical of government software, moving instead toward an aesthetic of **The Digital Sentinel**. This vision combines the precision of high-end aerospace interfaces with the clarity of premium editorial design. 

The goal is to instill absolute confidence during crises. We achieve this through **Organic Technicality**: a layout that feels engineered and rigid in its data accuracy, yet fluid and human in its presentation. We break the grid with intentional asymmetrical data overlays, massive typographic contrasts, and a deep sense of "environmental depth" where information isn't just displayed—it is staged.

---

## 2. Colors: Tonal Authority
Color here is not decorative; it is functional infrastructure. We utilize a palette that moves from the deep, authoritative shadows of command centers to the sterile, high-clarity whites of a laboratory.

*   **Primary (#051125 / #1B263B):** Represents the deep "Navy of State." Use `primary_container` for the core workspace and `primary` for high-impact navigation elements.
*   **Secondary & Status:** `secondary` (#006A60) acts as the "Safe State." `tertiary_container` (#55000C) and `error` (#BA1A1A) are reserved for high-priority emergency alerts.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. 
Structure must be defined through **Background Color Shifts**. To separate a sidebar from a main dashboard, place a `surface_container_low` panel against a `surface` background. If an element requires more focus, elevate it to `surface_container_highest`. We define boundaries by mass and tone, not by outlines.

### The "Glass & Gradient" Rule
To avoid a "flat" government feel, use **Glassmorphism** for floating command panels. Apply `surface_container_lowest` at 80% opacity with a 20px `backdrop-blur`. 
**Signature Textures:** Use subtle linear gradients (e.g., `primary` to `primary_container` at a 135° angle) for primary action buttons and data hero-headers to give them a "machined" metallic finish.

---

## 3. Typography: Editorial Urgency
We pair **Public Sans** (Display/Headlines) for its institutional, stable character with **Inter** (Body/Labels) for its mathematical legibility at small scales.

*   **Display Large (Public Sans, 3.5rem):** Use for "Pulse" metrics—the single most important number on a dashboard (e.g., Active Alerts).
*   **Headline Medium (Public Sans, 1.75rem):** For situational titles. High contrast against body text is required.
*   **Title Small (Inter, 1rem, Bold):** For data grouping headers.
*   **Label Small (Inter, 0.6875rem, Monospaced Tracking):** Used for timestamps and sensor IDs to provide a technical, "read-out" aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
In this system, depth is a metaphor for information importance. We do not use traditional "Drop Shadows" which look muddy.

*   **The Layering Principle:** 
    1. Base Floor: `surface`
    2. Regional Zones: `surface_container_low` 
    3. Interactive Cards: `surface_container_lowest` (Creating a "lifted" white-on-grey effect).
*   **Ambient Shadows:** When an element must "float" (e.g., a critical alert modal), use a shadow tinted with `primary` at 6% opacity with a 40px blur. It should look like an object casting a shadow in a room filled with soft blue light.
*   **The "Ghost Border" Fallback:** If accessibility requires a border (e.g., in high-contrast modes), use `outline_variant` at 15% opacity. Never use 100% opaque lines.

---

## 5. Components: Precision Primitives

### Cards & Data Modules
**Forbid the use of divider lines.** Use `surface_container` shifts or vertical whitespace (e.g., 32px/48px gaps) to separate telemetry data. Cards should have a `md` (0.375rem) corner radius to feel professional but not "playful."

### Buttons (The "Action Trigger")
*   **Primary:** A gradient of `primary` to `primary_container`. No border. High-contrast `on_primary` text.
*   **Secondary:** `surface_container_high` background with `on_surface` text. Feels integrated into the UI.
*   **Tertiary:** Transparent background, `label-md` typography with a 10% `outline_variant` "Ghost Border" on hover.

### Inputs & Dashboards
*   **Input Fields:** Use `surface_container_lowest` as the fill. The active state is indicated by a 2px `surface_tint` bottom-bar, rather than a full box stroke.
*   **Status Chips:** Use high-chroma `error` or `secondary` backgrounds with `on_error` or `on_secondary` text. Shape: `full` (9999px) for instant recognition as a status tag.
*   **Data Visualization:** All charts must use the `secondary` (Safe), `orange` (Warning), and `error` (Danger) tokens. Use `surface_variant` for grid lines within charts, kept at 10% opacity.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Negative Space:** Allow large data points to breathe. If a number is critical, give it 64px of clear space around it.
*   **Use Tonal Nesting:** Place a `surface_container_highest` element inside a `surface_container_low` panel to draw the eye to specific telemetry.
*   **Type Hierarchy:** Use `display-lg` for data and `label-sm` for metadata. The gap between them creates the "Technical Editorial" look.

### Don't:
*   **No "Box-in-a-Box":** Avoid drawing a box around every chart. Let the background color define the zone.
*   **No Pure Black:** Never use #000000. Use `primary` (#051125) for shadows and deep backgrounds to maintain the "Navy" brand soul.
*   **No Rounded Corners > 12px:** Anything more than `xl` (0.75rem) feels too consumer-focused. We are a government defense platform; stay sharp.

### Accessibility Note:
While we utilize tonal shifts, ensure the contrast ratio between `on_surface` and `surface_container` tiers meets WCAG AA standards. When in doubt, increase the contrast between the text and the background layer rather than adding an outline.