---
name: Tendly Landing
description: Warm charcoal and coral product storytelling for the public landing.
colors:
  paper: "#faf8f5"
  white: "#fffefa"
  sand: "#f0ebe3"
  line: "#e3ddd5"
  ink: "#252722"
  muted: "#4a4d45"
  coral: "#bc4532"
  peach: "#f8e4dc"
  green: "#45614c"
  sidebar: "#2c3029"
typography:
  display:
    fontFamily: "REM, sans-serif"
    fontSize: "clamp(38px,5.1vw,70px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "REM, sans-serif"
    fontSize: "clamp(32px,3.5vw,46px)"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  body:
    fontFamily: "REM, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "REM, sans-serif"
    fontSize: "12px"
rounded:
  control: "5px"
  action: "7px"
  card: "8px"
  stage: "12px"
spacing:
  compact: "12px"
  panel: "16px"
  content: "24px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "13px 23px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#41453b"
  button-coral:
    backgroundColor: "{colors.coral}"
    textColor: "#ffffff"
    rounded: "{rounded.action}"
    padding: "13px 23px"
  button-coral-hover:
    backgroundColor: "#ad3c2b"
  approval:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  editor:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
  selected-situation:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
---

# Design System: Tendly Landing

## Overview

**Creative North Star: "A shop's working day, made visible"**

Warm paper surfaces, charcoal typography and coral accents frame a photographic product tour. Clothing, conversations and shop decisions appear together in layered compositions, so the page can explain more with less prose. This is the user-approved replacement implemented on the public `/` route; authenticated screens, global app styling, backend and authentication retain their own systems.

**Key Characteristics:**

- Local REM typography and the existing Tendly identity.
- Flat tonal panels, fine dividers and layered photographic stories.
- Five selectable work scenes and four independent visual chapters.
- Visible shop review states and controllable motion.

## Colors

### Primary

Coral identifies exploration, selected scenes and scroll progress. Charcoal gives navigation and account-entry actions their visual weight.

### Secondary

Green communicates review, recommendation and keyboard focus; peach contains the closing invitation.

### Neutral

Paper is the page ground, white contains content, sand separates selected situations and supporting stages, and fine warm dividers organize dense UI. Muted text supports charcoal headings; the dark sidebar anchors the workspace.

**The Scoped World Rule.** These tokens belong to the landing root; do not spread them into authenticated product screens without a separate brief.

## Typography

Local variable **REM**, with sans-serif fallback, serves display, prose and UI. The font at `public/landing/fonts/REM.ttf` supports weights 100–900, uses swap, and retains its OFL license. Large headlines are expressive without the earlier heavy navy treatment. Desktop roles are recorded in frontmatter; mobile display uses `clamp(33px,7.8vw,53px)`. Chapter titles use `clamp(28px,2.5vw,35px)` and UI uses readable 12–14px sizes. The exact English slogan **Your AI teammate for every customer** retains `lang="en"`; supporting copy is Vietnamese.

## Layout

The centered container caps at 1200px and expands to 1280px above 1450px. Navigation is sticky with 84px desktop and 70px mobile height. Floating shop, host and size cards surround the desktop workspace; at 1100px they enter the document flow. At 760px the sidebar hides, five tabs wrap, situation pills scroll horizontally, four visual canvases appear inline and setup/ecosystem stories stack. Gutters step from 48px desktop to 28px, 20px and 16px at the observed 1050px, 760px and 390px thresholds.

Four scroll chapters share a pinned visual stage on desktop. Their compositions differ: polo/size chart/chat; live host/comments/draft order; moodboard/social draft; product comparison/recommendation. Three setup storyboards show knowledge, routing and shop approval. The routing hub uses the actual Tendly logo. Supplier MOQ and a static product-email card explain the ecosystem; there is no Email activation checkbox or status below the feature copy.

## Elevation & Depth

There is no card-shadow system. Depth comes from warm tonal layering, fine borders, overlapping photographs, small rotations and controlled parallax. Ambient hero light and a border beam add motion around the workspace. Images retain rounded clipping rather than heavy frames.

## Shapes

Broad rounded stages contain smaller rectangular cards and controls. The normative radius roles are in frontmatter; photographic cards vary within 5–10px according to their composition. Situation pills and status dots provide compact exceptions. Tables retain aligned numerals and readable row boundaries.

## Components

### Actions and navigation

Charcoal account-entry actions and the coral exploration action share restrained geometry and a 200ms hover lift. Header and closing CTAs use Next Link to `/dang-nhap`; exploration anchors stay on the landing. Focus uses a green 3px outline with 5px offset. Mobile navigation exposes expanded state, closes on Escape and returns focus. Controls retain 44px minimum targets where implemented; primary actions use 48px.

### Workspace and editor

Five keyboard-operable tabs expose fifteen contextual situations. Streaming answers can be edited, validated, saved, cancelled and approved locally. Approval changes the local review state and emits a brief particle burst; it does not send, publish or place an order. The labeled textarea uses a visible focus outline and rejects empty edits. Streaming completion preserves editing/approved states.

Playback advances every 4.5 seconds with a visible pause control and progress indicator. Hover, offscreen visibility, hidden document and editing suspend progression; manual selection stops autoplay. Ambient light, headline shimmer, border beam and qualitative marquee follow playback/visibility.

### Photographic stories

The pinned stage changes independently of the hero. Layers enter over 700ms with a 150ms stagger; photographs unveil with clipping over 800ms desktop and 650ms mobile. Scroll connectors use native timelines with a JavaScript fallback; parallax stays within 30px. Parent-observed reveals trigger near 80% viewport, with static visible content before enhancement. Contextual image alternatives and canvas labels describe the story.

### Identity, assets and lifecycle

Header and routing hub share `/tendly-logo.png`. Seven optimized WebPs in `public/landing/story/` total 635,496 bytes: six generated photographs and a derivative of the existing navy product illustration. Exact prompts and per-image provenance sidecars accompany them. These are synthetic brand images, not customer endorsements. Native Next Image renders already optimized assets with `unoptimized`.

Server-rendered `LandingPage` owns markup. `LandingExperience` mounts the root-scoped interaction initializer and returns its cleanup. CSS Module classes and variables stay under the landing root; conditional document scroll styles apply only while that root exists. AbortSignal listeners, disconnected observers and cancelled timers/frames prevent interaction loops surviving navigation.

**The Visible Without Motion Rule.** Reduced motion removes autoplay, streaming, spatial effects, particles and pseudo-element animation; all content remains visible and the marquee becomes static. Preserve skip link, native FAQ, tab arrows/Home/End, focus rings, editor labels, busy states and polite announcements.

## Do's and Don'ts

### Do:

- **Do** retain the existing logo, exact English slogan and local font license.
- **Do** preserve distinct visual chapters, mobile inline canvases and shop review states.
- **Do** preserve root scoping, navigation cleanup and reduced-motion visibility.
- **Do** keep image provenance with optimized public assets.

### Don't:

- **Don't** apply landing tokens to other app surfaces without a separate brief.
- **Don't** restore the removed Email toggle, activation status or Pilot form.
- **Don't** infer live-provider delivery from local tour interactions.
- **Don't** treat synthetic photographs as customer endorsements.

Chapter reading focus uses 35% opacity for inactive desktop chapters and an 8px shift for the active chapter, with four coral progress nodes. Mobile keeps every chapter fully readable; reduced motion removes the shift and entrances. Chapter labels are peach pills above headings per the supplied brief. Narrative copy uses 18px hero, 16px section/chapter and 14.5px step text, with selected ink semibold keywords. Overlay cards use soft depth shadows and livestream comments use backdrop blur.
