# Carousel Dump Builder — Design Brainstorm

Since the spec explicitly requires matching the V4 report's exact design, the brainstorm focuses on how to layer interactive features while preserving the V4 aesthetic.

<response>
<text>
## Approach 1: Faithful V4 Replica with Minimal Interaction Chrome

**Design Movement**: Direct port of V4's editorial dark theme — no new chrome, interactions revealed through gesture hints only.

**Core Principles**:
- Exact V4 CSS variables: --bg: #0a0a0a, --card: #151515, --accent: #c8a96e, --border: #1e1e1e
- Interaction affordances are invisible until triggered (long-press shimmer, drag ghost)
- The photo is always the hero — UI controls are whisper-thin overlays
- Mobile-first touch: swipe to browse, long-press to pick up, drop zones glow on hover

**Color Philosophy**: V4's exact palette — near-black backgrounds, warm gold accent (#c8a96e), muted grays for secondary text. Red (#e74c3c) only for Huji borders.

**Layout Paradigm**: Single-column dump sections with horizontal scroll-snap strips (200px wide thumbs, 260px tall). Photo pool as a grid below.

**Signature Elements**: Gold accent badge on first slide, gradient overlay at bottom of each thumb, thin scrollbar with gold thumb.

**Interaction Philosophy**: Swipe is default. Long-press (300ms) lifts a photo with scale animation. Drop zones pulse with gold glow. Double-tap opens context menu.

**Animation**: Subtle — 200ms transitions on border-color, scale(1.05) on drag pickup, opacity fade for drop zones.

**Typography System**: Inter (system fallback), 11px uppercase letter-spaced labels, clamp() responsive headings.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Approach 2: V4 Base with Floating Action Panel

**Design Movement**: V4 core + a floating bottom sheet for actions (iOS-style).

**Core Principles**:
- V4 layout preserved pixel-for-pixel
- A draggable bottom sheet rises from the bottom with action buttons (new dump, reset, help)
- Selected photo gets a pulsing gold ring
- Drag handles appear as subtle grip dots on each photo when in edit mode

**Color Philosophy**: Same V4 palette with an additional semi-transparent overlay (rgba(0,0,0,0.6)) for modal states.

**Layout Paradigm**: V4 scroll strips + a collapsible bottom panel for the photo pool (saves vertical space on mobile).

**Signature Elements**: Bottom sheet with rounded top corners, grip indicator, frosted glass effect.

**Interaction Philosophy**: Toggle between "browse" and "edit" modes. Browse = swipe. Edit = drag-and-drop enabled.

**Animation**: Spring-based bottom sheet, 300ms cubic-bezier transitions, parallax on photo zoom.

**Typography System**: Same as V4 — Inter, uppercase labels, clamp headings.
</text>
<probability>0.05</probability>
</response>

<response>
<text>
## Approach 3: V4 Exact with Inline Gesture Layer

**Design Movement**: Pure V4 preservation — zero additional UI elements. All interaction through native touch gestures.

**Core Principles**:
- No mode toggles, no floating panels, no extra buttons visible
- Long-press initiates drag (with haptic-style visual feedback)
- Swipe and drag coexist through gesture discrimination (horizontal swipe = browse, long-press + move = drag)
- "New Dump" is a + card at the end of the dump list
- Photo pool scrolls horizontally like dumps but with smaller cards

**Color Philosophy**: Exact V4 — no new colors introduced.

**Layout Paradigm**: Vertical stack of horizontal scroll strips. Pool section uses same strip pattern but with 3-column grid for density.

**Signature Elements**: Ghost image during drag (semi-transparent clone), gold drop-zone indicators, red Huji ring.

**Interaction Philosophy**: The interface teaches itself — first-time hint overlay fades after 3 seconds. Everything discoverable through touch.

**Animation**: 150ms ease-out for all transitions. Drag ghost follows finger with 0.85 opacity. Drop target scales to 1.02.

**Typography System**: V4's Inter stack, same sizing, same letter-spacing.
</text>
<probability>0.07</probability>
</response>

## Selected: Approach 3 — V4 Exact with Inline Gesture Layer

This approach best honors the spec requirement to preserve V4 exactly while layering interactive features through native touch gestures. No extra UI chrome — the photos remain the hero.
