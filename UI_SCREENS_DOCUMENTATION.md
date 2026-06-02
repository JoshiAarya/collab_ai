# CollabAI — Complete UI Screens Documentation

> This document catalogs every screen, modal, panel, and interactive element in the CollabAI frontend.
> Intended for a design revamp: color palette, typography, spacing, and visual language can all be changed.

---

## Current Design System (to be revamped)

### Color Palette (Dark Mode — default)
| Token | Value | Usage |
|---|---|---|
| background | `#0d0d0d` | Page background |
| surface | `#1a1a1a` | Cards, modals, sidebar |
| surfaceHover | `#2d2d2d` | Hover states |
| border | `#2d2d2d` | All borders |
| text | `#ececec` | Primary text |
| textSecondary | `#b4b4b4` | Secondary text |
| textTertiary | `#6b6b6b` | Muted/placeholder text |
| primary | `#8b5cf6` | Purple — buttons, accents, active states |
| success | `#10a37f` | Green — success states |
| error | `#ef4444` | Red — errors, high-severity blockers |
| warning | `#f59e0b` | Amber — warnings |
| iconBar | `#000000` | Far-left icon strip |

### Color Palette (Light Mode)
| Token | Value |
|---|---|
| background | `#ffffff` |
| surface | `#f7f7f8` |
| surfaceHover | `#ececed` |
| border | `#e5e5e5` |
| text | `#0d0d0d` |
| textSecondary | `#565869` |
| textTertiary | `#8e8ea0` |
| primary | `#8b5cf6` (same) |
| iconBar | `#f7f7f8` |

### Typography
- Font family: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Code font: `Courier New, monospace`
- No custom web font currently loaded

### Border Radius
- Cards/modals: `12px`
- Buttons: `8px`
- Inputs: `8px`
- Tags/badges: `16–20px` (pill)
- Avatars: `50%` (circle) or `4px` (square variant)

### Animations
- `fadeIn` — opacity 0→1 + translateY 10px→0, 0.3s
- `slideUp` — opacity 0→1 + translateY 20px→0, 0.3s–0.4s
- `scaleIn` — scale 0.8→1 + opacity, 0.4s
- `spin` — 360° rotation, 1s linear infinite (loading spinner)
- `pulse` — opacity 0.4↔1, 1.4s (thinking dots)

---

---

## SCREEN 1 — Loading Screen

**File:** `App.jsx`
**Trigger:** App is initializing / checking auth token

### Layout
- Full viewport, centered vertically and horizontally
- Background: `#0d0d0d`

### Elements
1. **Spinner** — 40×40px circle, border `4px solid #2d2d2d`, top border `4px solid #8b5cf6` (purple), `spin` animation
2. **Text** — "Loading..." — 16px, color `#6b7280`

### No buttons or interactions.

---

## SCREEN 2 — Auth Screen (Login / Register)

**File:** `components/Auth.jsx`
**Trigger:** User is not authenticated

### Layout
- Full viewport centered
- Background: `#0d0d0d`
- Single centered card: max-width 420px, background `#1a1a1a`, border `1px solid #2d2d2d`, border-radius `12px`, padding `48px 40px`

### Elements

#### Logo / Icon
- 56×56px square, border-radius `12px`, background `#8b5cf6` (purple)
- SVG icon: layered diamond/stack shape (white, 32×32)

#### Title
- Login mode: "Welcome back"
- Register mode: "Create your account"
- 28px, font-weight 600, color `#ececec`, centered

#### Form (Login mode)
1. **Email input** — full width, placeholder "Email address", type=email, padding `14px 16px`, bg `#0d0d0d`, border `1px solid #2d2d2d`, border-radius `8px`, color `#ececec`, auto-focused
2. **Password input** — full width, placeholder "Password", type=password, same styling, minLength=6

#### Form (Register mode — adds one extra field at top)
1. **Username input** — full width, placeholder "Username", type=text, auto-focused
2. **Email input** — same as login
3. **Password input** — same as login

#### Error Banner (conditional)
- Shown when login/register fails
- Background `rgba(239,68,68,0.1)`, border `1px solid rgba(239,68,68,0.2)`, color `#f87171`, padding `12px 16px`, border-radius `8px`, font-size 14px

#### Submit Button
- Full width, padding `14px 16px`, background `#8b5cf6`, border-radius `8px`, color white, 16px font-weight 600
- Login mode label: "Continue" (or "Please wait..." when loading)
- Register mode label: "Sign up" (or "Please wait..." when loading)
- Disabled + opacity 0.7 when loading

#### Divider
- Horizontal line with centered "OR" text, color `#6b6b6b`, 13px

#### Google OAuth Button
- Full width, padding `14px 16px`, background transparent, border `1px solid #2d2d2d`, border-radius `8px`, color `#ececec`, 15px
- Google multicolor SVG logo (18×18) on left
- Label: "Continue with Google"
- Clicking redirects to `/api/auth/google`

#### Footer Toggle
- 14px, color `#6b6b6b`
- Login mode: "Don't have an account? **Sign up**"
- Register mode: "Already have an account? **Log in**"
- Toggle link: color `#a78bfa` (light purple), font-weight 600, no underline, button element

#### Invite Banner (conditional — shown above card when arriving via invite link)
- Background `#1a1a1a`, border `1px solid #2d2d2d`, border-radius `8px`, padding `16px`, max-width 420px, centered
- Green text (14px, `#10a37f`): "🎉 You've been invited to join a project!"
- Gray text (13px, `#b4b4b4`): "Please log in or create an account to continue"

---

## SCREEN 3 — Onboarding (4-step walkthrough)

**File:** `components/Onboarding.jsx`
**Trigger:** First login, `onboarding-completed` not in localStorage

### Layout
- Full viewport overlay, background `rgba(0,0,0,0.95)`, z-index 10000
- Centered modal: max-width 500px, width 90%, background `#1a1a1a`, border-radius `20px`, padding `60px 40px 40px`, border `1px solid #2d2d2d`
- `slideUp` animation on mount

### Elements

#### Skip Button
- Position: absolute top-right of modal (top `20px`, right `20px`)
- Background none, no border, color `#6b7280`, 14px
- Label: "Skip"
- Clicking: marks onboarding complete, closes

#### Step Icon
- 64×64 SVG, color changes per step:
  - Step 1 (Welcome): `#8b5cf6` purple — layered diamond icon
  - Step 2 (Create Projects): `#10a37f` green — chat bubble icon
  - Step 3 (AI Discussions): `#f59e0b` amber — question circle icon
  - Step 4 (Smart Insights): `#3b82f6` blue — bar chart icon
- `scaleIn` animation

#### Step Title (28px, font-weight 600, `#ececec`)
- Step 1: "Welcome to CollabAI! 🎉"
- Step 2: "Create Projects"
- Step 3: "AI-Powered Discussions"
- Step 4: "Smart Insights"

#### Step Description (16px, `#b4b4b4`, line-height 1.7, max-width 400px centered)
- Each step has a 1–2 sentence description

#### Progress Dots
- Row of 4 dots, 8×8px circles, gap `8px`, centered
- Active dot: `#8b5cf6` (purple)
- Inactive dots: `#2d2d2d` (dark gray)
- Smooth color transition

#### Primary Button
- Full width, padding `16px`, background `#8b5cf6`, border-radius `10px`, color white, 16px font-weight 600
- Steps 1–3: "Next"
- Step 4: "Get Started"
- Clicking advances step or completes onboarding

---

## SCREEN 4 — Project List (Home / Dashboard)

**File:** `components/ProjectList.jsx`
**Trigger:** User is authenticated, no project selected

### Layout
- Full viewport, flex row
- Left: Sidebar (collapsible)
- Right: Main content area (empty state or project list)

### Sidebar (Left Panel)

#### Icon Bar (always visible, 48px wide, background `#000000`)
- **Logo/Toggle button** (40×40px): Shows app logo icon normally; on hover shows sidebar-toggle icon. Clicking toggles sidebar open/closed.
- **New Project button** (40×40px, only when sidebar is closed): Plus icon (`+`), title="New project"
- **Spacer** (flex: 1)
- **User Avatar** (32×32px circle, color from username hash): Shows user initials. Only visible when sidebar is closed.

#### Sidebar Panel (280px wide, background `#1a1a1a` / surface, only when open)
- **Header area** (padding `12px`):
  - "New project" button — full width, flex row with `+` icon and "New project" text, transparent background, border `1px solid border-color`, border-radius `6px`, 14px
- **Projects list** (scrollable, flex: 1):
  - Each project item: flex row, chat-bubble SVG icon (18×18) + project title text, padding `10px 12px`, border-radius `6px`, cursor pointer, hover background
  - Title truncated with ellipsis if too long
- **Footer** (padding `16px`, border-top):
  - "Join project" button — flex row with person-plus SVG icon + "Join project" text, full width, transparent, 14px
  - **User section** (clickable, opens dropdown):
    - 40×40px circle avatar (color from username hash) with initials
    - Username (14px, font-weight 500)
    - Email (12px, muted)
    - Chevron-up icon (16×16)

#### User Dropdown (appears above user section)
- Background: surface color, border, border-radius `10px`, padding `6px`, box-shadow, z-index 2000
- **Profile** item — person SVG icon + "Profile" text
- **Switch to Light/Dark Mode** item — sun/moon SVG icon + mode label
- **Divider** — 1px horizontal line
- **Log out** item — logout SVG icon + "Log out" text

### Main Content Area

#### Empty State (centered, max-width 600px)
- Large chat-bubble SVG icon (64×64, muted color)
- Title: "CollabAI Workspace" — 32px, font-weight 600
- Subtitle: "Create a project to start collaborating with your team and AI" — 16px, secondary color
- **"Create new project" button** — padding `12px 24px`, background `#8b5cf6`, border-radius `8px`, white text, 14px font-weight 600
- **"Join existing project" button** — padding `12px 24px`, transparent, border, border-radius `8px`, 14px font-weight 600

---

## MODAL A — Create Project Modal

**File:** `components/ProjectList.jsx` → `CreateProjectModal`
**Trigger:** Clicking "New project" or "Create new project"

### Layout
- Full-screen overlay, background `rgba(0,0,0,0.8)`, centered
- Modal card: max-width 500px, border-radius `12px`, max-height 90vh, scrollable

### Step 1 — Create Form

#### Header
- Title: "Create new project" — 18px, font-weight 600
- **Close (×) button** — top-right, SVG X icon, 20×20, muted color

#### Form Fields
1. **Project title** — label "Project title", input placeholder "e.g., Product Launch Planning", required, auto-focused
2. **Problem statement** — label "Problem statement", textarea placeholder "Describe what you're trying to solve...", min-height 120px, resizable vertically, required

#### Action Buttons (right-aligned)
- **Cancel** — transparent, border, border-radius `8px`, 14px
- **Create project** — background `#8b5cf6`, white, border-radius `8px`, 14px font-weight 600, disabled + "Creating..." when loading

### Step 2 — Success / Invite (shown after project created)

#### Header
- Green checkmark circle icon (48×48, `rgba(139,92,246,0.1)` bg, `#8b5cf6` icon)
- Title: "Project Created!"

#### Body
- Success message: "Your project '[title]' has been created successfully."
- **Invite section** (background, border, border-radius `12px`, padding `20px`):
  - Title: "Invite Team Members" — 16px, font-weight 600
  - Description text
  - **Invite link box**: monospace URL in `#8b5cf6` color + **Copy button** (clipboard SVG → checkmark SVG when copied)
  - Hint: info-circle SVG + "Anyone with this link can join your project"
  - **Email invite section** (below divider):
    - Label: "Or send invitation via email:"
    - Email input + **Send button** (`#8b5cf6`, disabled when empty or sending)
- **"Start Collaborating" button** — full width, `#8b5cf6`, closes modal and opens project

---

## MODAL B — Join Project Modal

**File:** `components/ProjectList.jsx` → `JoinProjectModal`
**Trigger:** Clicking "Join project" or "Join existing project"

### Step 1 — Enter Code

#### Header
- Title: "Join project"
- Close (×) button

#### Form
- Label: "Invite code"
- Input: placeholder "Enter 8-character code", maxLength=8, auto-focused
- Error banner (red, conditional)

#### Action Buttons
- **Cancel** — transparent, border
- **Join project** — `#8b5cf6`, disabled + "Joining..." when loading

### Step 2 — Success State (replaces modal)
- Green checkmark circle (80×80, `rgba(16,163,127,0.1)` bg, `#10a37f` icon), `scaleIn` animation
- Title: "Welcome to the Team!" — 24px, font-weight 600
- Message: "You've successfully joined '[title]'. Start collaborating with your team now!"
- **"Start Collaborating" button** — full width, background `#10a37f` (green)

---

## MODAL C — Invite Confirm Modal (from invite link)

**File:** `App.jsx` → `InviteConfirmModal`
**Trigger:** User arrives via `/join/[code]` URL while logged in

### Layout
- Full-screen overlay, backdrop-filter blur(4px), background `rgba(0,0,0,0.85)`
- Modal: max-width 480px, background `#1a1a1a`, border-radius `12px`, `slideUp` animation

### Elements

#### Header (centered, border-bottom)
- Large emoji icon: 💬 for discussion invite, 🎉 for project invite (48px)
- Title: "Discussion Invite" or "Project Invite" — 20px, font-weight 600

#### Body
- Loading state: "Loading invite details..." centered text
- Loaded state:
  - Description text (15px, `#b4b4b4`, centered): explains what they're joining
  - **Info note** (conditional for discussion invites): purple info-circle SVG + explanation text, `rgba(139,92,246,0.1)` background, purple border
  - **Details box** (dark background, border, border-radius `8px`, padding `16px`):
    - "Project:" label + value
    - "Discussion:" label + value (if discussion invite)
    - "Members:" label + count value
    - Each value in a small box with border

#### Footer (border-top, flex row)
- **Decline button** — flex: 1, transparent, border `1px solid #2d2d2d`, border-radius `8px`, color `#b4b4b4`, 14px
- **Accept & Join / Continue button** — flex: 1, gradient `linear-gradient(135deg, #8b5cf6, #7c3aed)`, white, border-radius `8px`, 14px font-weight 600
  - Label changes: "Joining..." when loading, "Continue" if already member+participant, "Accept & Join" otherwise
  - Disabled when loading, loading invite info, or no invite info

---

---

## SCREEN 5 — Project Workspace (Main Chat View)

**File:** `components/ProjectWorkspace.jsx`
**Trigger:** User selects a project from the project list

### Layout
- Full viewport, flex row
- Left: Sidebar (collapsible, same structure as ProjectList sidebar but with discussion list)
- Right: Main area (header + message feed + input)

### Sidebar

#### Icon Bar (48px, `#000000`)
- **Logo/Toggle button** — same as ProjectList
- **Back to projects button** (when sidebar closed): house SVG icon, title="Back to projects"
- **New discussion button** (when sidebar closed): plus SVG icon, title="New discussion"
- **Spacer**
- **User Avatar** (when sidebar closed)

#### Sidebar Panel (280px)
- **Header row** (padding `12px`):
  - **"← Projects" button** — back-arrow SVG + "Projects" text, border, border-radius `6px`, 14px — navigates back to project list
  - **Close sidebar (×) button** — right side, X SVG, muted color
- **Discussions section** (scrollable, padding `8px`):
  - Section label: "DISCUSSIONS" — 12px, uppercase, letter-spacing, muted color
  - **Add discussion (+) button** — right of label, plus SVG, muted
  - **Discussion items** (each):
    - Main Thread item: bookmark SVG icon, bold text "# Main Thread", green left border (`3px solid #10a37f`), active state = `rgba(255,255,255,0.1)` background
    - Regular discussion item: chat-bubble SVG icon, discussion title text
    - Active item highlighted
    - ⚠️ emoji if summary is stale (10+ new messages since last summary)
    - **Invite button** (person-plus SVG, 14×14) — appears on hover for non-main discussions where user is participant
    - Metadata row below title: message count + relative time ("5m ago", "2h ago", "3d ago") in 11px muted text
- **Footer** (same as ProjectList sidebar footer — user section + dropdown)

### Main Area

#### Header Bar (surface background, border-bottom)
- **Model Selector** (left side) — see Component: Model Selector below
- **Discussion/Project Title** — 16px, font-weight 600, truncated
- **Three-dot menu button** (right side) — vertical dots SVG, 20×20

#### Three-dot Dropdown Menu
- Background: surface, border, border-radius `8px`, min-width 180px, box-shadow, z-index 1000
- Items (each with SVG icon + label):
  - **Dashboard** — grid SVG + "Dashboard" (owner only)
  - **Documents** — file SVG + "Documents"
  - **Discussion Summaries** (if on Main Thread) — clipboard SVG + "Discussion Summaries"
  - **Summarize** (if on non-main discussion) — clipboard SVG + "Summarize"
  - **Settings** — gear SVG + "Settings"
  - **Refresh** — refresh-arrows SVG + "Refresh"

#### Message Feed (scrollable, flex: 1)

**Empty state:**
- Centered, discussion/project title (28px, font-weight 600)
- "Start the conversation" (16px, secondary)
- "Use @CollabAI to get AI assistance" (14px, muted)

**Message bubbles** (each message):
- Full-width row, padding `24px 0`, border-bottom `1px solid border`
- AI messages: surface background
- User messages: transparent background
- Max content width: 48rem, centered, padding `0 24px`
- Layout: avatar (left for AI/others, right for current user) + content

  **AI message avatar:** 30×30px square, border-radius `4px`, background `#8b5cf6`, "C" letter (CollabAI initial), white
  **User avatar:** 30×30px square, border-radius `4px`, color from username hash, user initials
  **Username:** 14px, font-weight 600, above message content
  **Message content:** rendered as Markdown (via `marked` + `DOMPurify`), `.markdown-content` class styles

**AI Thinking indicator** (shown while AI is processing):
- Same layout as message row
- AI avatar + three animated dots (`.thinking-dots span` — 8×8px circles, `pulse` animation staggered)

#### Connection Status Banner (conditional)
- Shown when WebSocket is not connected
- Yellow background (`#f59e0b`), black text, centered, 13px font-weight 500
- "🔄 Connecting..." / "🔄 Reconnecting..." / "⚠️ Disconnected - Attempting to reconnect..."

#### Input Area (surface background, border-top)

**Mention Popup** (appears above input when typing `@`):
- Positioned above input box, max-width 48rem, background surface, border, border-radius `8px`, max-height 300px scrollable
- Each mention option:
  - 32×32px avatar (green `#10a37f` for AI, purple `#5436da` for users)
  - Name (14px, font-weight 600)
  - Username handle (12px, muted)
  - Clicking inserts `@Name ` into input

**Input Box** (max-width 48rem, centered, background surface, border, border-radius `12px`, flex row):
- **Attach (+) button** (left): plus SVG, 20×20, muted color, opens attach menu
  - **Attach Menu** (popup above button): "Upload Document" option with file SVG icon — hidden file input accepting `.txt,.md`
- **Textarea** (flex: 1): auto-resizing (1 row to max 200px), placeholder "Send a message...", transparent background, no border, 16px, `Enter` sends (Shift+Enter = newline)
- **Send button** (right): paper-plane SVG, 20×20, color `#8b5cf6`, opacity 0.3 when empty, opacity 1 when has text, disabled when empty

---

## MODAL D — Create Discussion Modal

**File:** `components/ProjectWorkspace.jsx` → `CreateDiscussionModal`
**Trigger:** Clicking "+" in discussions header or icon bar

### Elements
- Header: "Create New Discussion" + close (×) button
- **Discussion name input** — placeholder "Discussion name...", auto-focused
- **Cancel button** — transparent, border
- **Create button** — `#8b5cf6`, disabled when input empty

---

## MODAL E — Invite to Discussion Modal

**File:** `components/ProjectWorkspace.jsx` → `InviteToDiscussionModal`
**Trigger:** Clicking person-plus icon on a discussion item

### Layout
- Overlay + modal card, max-width ~500px

### Header
- "Invite to [Discussion Name]" + close (×) button

### Tabs (two tabs, border-bottom underline style)
- **Project Members** tab — active: `#8b5cf6` underline + primary text color
- **External Invite** tab — same styling

### Tab: Project Members
- Loading state: "Loading..." centered
- Empty state: "All project members are already in this discussion"
- Member list (max-height 300px, scrollable):
  - Each member row: 40×40px circle avatar (color from username hash) + username (14px, font-weight 500) + email (12px, muted) + **Add button** (`#8b5cf6`, hover `#7c3aed`, padding `8px 16px`, border-radius `6px`)

### Tab: External Invite
- Description text
- **Invite link box**: monospace link in `#10a37f` + **Copy button** (clipboard/checkmark SVG)
- **OR divider**
- **Email section**:
  - Label: "Send via email"
  - Email input + **Send button** (`#8b5cf6`, disabled when empty or sending)
  - Hint: "They'll receive an email with the invite link"

---

## SCREEN 6 — Dashboard (Project Intelligence)

**File:** `components/ProjectWorkspace.jsx` → `Dashboard`
**Trigger:** Clicking "Dashboard" from three-dot menu (owner only)

### Layout
- Full viewport page (replaces workspace)
- Header bar + scrollable content area

### Header Bar (surface background, border-bottom)
- **"← Back" button** — back-arrow SVG + "Back", border, border-radius `8px`
- **Title:** "Dashboard" — 28px, font-weight 700
- **Subtitle:** project title — 14px, muted
- **Project summary** (italic, muted, if available)
- **Refresh button** (right) — refresh-arrows SVG + "Refresh" / "Refreshing...", border, border-radius `8px`

### Loading State
- Centered spinner + "Loading insights..." text

### Content (max-width 1600px, padding `32px`)

#### Project Health Bar (top strip)
- 5 cells in a row, each with label + value:
  1. **Stage** — colored text (purple=ideation, blue=design, green=discussion, red=blocked, cyan=completed)
  2. **Momentum** — "X msg/disc" in primary text color
  3. **Open Blockers** — red number if >0, green if 0; cell has red tint background if blockers exist
  4. **Action Items** — count
  5. **Active Discussions** — count

#### Two-Column Grid (65% left / 35% right)

**Left Column:**

1. **Project Intelligence Card** (component: `ProjectIntelligenceCard`)
   - Header: "Project Intelligence" + stage badge (colored pill, capitalized)
   - Stage reason (italic, muted, if available)
   - 4-metric grid:
     - Momentum: trend arrow (↑↓→) + msgs/week count, colored by trend (green/amber/red)
     - Open Blockers: count, red if >0, green if 0
     - Pending Actions: count
     - Active Topics: count
   - "Last decision: [date]" footer (if available)

2. **Decision Timeline** (component: `DecisionTimeline`)
   - Card with title "Decision Timeline"
   - Vertical timeline list (up to 10 decisions, newest first):
     - Green dot (10×10px circle) + vertical line connector
     - Decision text (14px, font-weight 500, clickable if has detail)
     - Topic badge (purple pill) + date (muted) + "▼ more" toggle
     - Expanded: rationale text in dark box

3. **Topic Distribution** card
   - Title "Topic Distribution" + "View All (N)" button if >5 topics
   - Horizontal bar chart rows (up to 5):
     - Topic name + progress bar (purple fill) + count number

4. **Key Decisions** card
   - Title "Key Decisions" + "View All (N)" button if >5
   - Timeline list with numbered purple gradient badges + decision text

5. **Action Items** card
   - Title "Action Items" + "View All (N)" button if >5
   - Checkbox list: square checkbox (filled if completed) + action text

**Right Column:**

1. **Blocker Tracker** (component: `BlockerTracker`)
   - Card with title "Blocker Tracker"
   - Each open blocker:
     - Left border colored by severity (red=high, amber=medium, gray=low)
     - Severity badge (uppercase, colored bg): HIGH / MED / LOW
     - Blocker text (14px)
     - Topic badge (purple pill) + days open (red if ≥5 days)

2. **Current Stage** card
   - Stage badge (large colored pill, capitalized)
   - "Last updated [date]" muted text

3. **Activity** card (weekly bar chart)
   - 7 bars (M T W T F S S labels)
   - Today's bar: `#667eea` (blue-purple), others: `rgba(102,126,234,0.3)`

4. **Discussion Activity** card
   - Each discussion: title + "count (percentage%)" + horizontal progress bar
   - Main thread bar: `#10b981` green; others: `#667eea` blue-purple

5. **Message Distribution** card
   - Conic gradient "pie chart" (80×80px circle)
   - Legend: User Messages (blue-purple) + AI Responses (purple) with counts and percentages

6. **Top Contributors** card
   - Each contributor: circle avatar (color from username hash) + username + "N messages (X%)"

7. **Summary** card
   - Total Messages: count
   - Documents: count
   - Data Source: "Cached" (green) or "Live" (amber)

### Expanded Modals (clicking "View All")
- Overlay + modal, max-width 600px, max-height 80vh, scrollable
- Title: "All Topics" / "All Decisions" / "All Blockers" / "All Action Items"
- Close (×) button
- Full list of items

---

## SCREEN 7 — Documents

**File:** `components/ProjectWorkspace.jsx` → `Documents`
**Trigger:** Clicking "Documents" from three-dot menu

### Layout
- Full viewport page

### Header Bar
- **"← Back" button**
- **Title:** "Documents" — 24px, font-weight 600
- **Upload button** (right): upload-arrow SVG + "Upload" / "Uploading...", background `#8b5cf6`, white, border-radius `6px` — triggers hidden file input (`.txt,.md` only)

### Content (max-width 1200px, padding `24px`)

**Empty state:**
- "No documents uploaded yet" (16px, secondary)
- "Upload .txt or .md files to provide context for AI" (14px, muted)

**Document list** (grid, gap `12px`):
- Each document card (surface background, border, border-radius `8px`, padding `16px`, flex row):
  - File SVG icon (24×24)
  - Document info:
    - Filename (14px, font-weight 600)
    - "[X] KB • Uploaded [date]" (12px, secondary)
    - Embedding status: "✓ Embeddings ready" (green, 11px) or "⏳ Processing embeddings..." (amber, 11px)

---

## SCREEN 8 — Summaries (Single Discussion)

**File:** `components/ProjectWorkspace.jsx` → `Summaries`
**Trigger:** Clicking "Summarize" from three-dot menu (non-main discussions only)

### Layout
- Full viewport page

### Header Bar
- **"← Back" button**
- **Title:** "Summaries" — 24px
- **Generate Summary button** — `#8b5cf6`, "Generate Summary" / "Generating..." when loading

### Content (max-width 900px, padding `24px`)

**Empty state:**
- "No summaries yet" + "Generate a summary to capture key insights from this discussion"
- **Generate Summary button** (centered, `#8b5cf6`)

**Summary cards** (each):
- Background `#40414f`, border, border-radius `12px`, padding `20px`
- **Card header** (border-bottom):
  - Date (13px, muted, font-weight 500)
  - Provider badge (12px, muted, small pill background)
  - **Edit/Refine button** — pencil SVG, border, border-radius `6px`
  - **Regenerate button** — refresh SVG, border, border-radius `6px`
- **Summary content** — 14px, line-height 1.6, pre-wrap
- **Refine box** (shown when editing):
  - Textarea: placeholder "Enter refinement instructions...", resizable, border, border-radius `8px`
  - **Cancel button** — transparent, border
  - **Regenerate button** — `#10a37f` green, "Regenerate" / "Regenerating..."

---

## SCREEN 9 — All Discussion Summaries

**File:** `components/ProjectWorkspace.jsx` → `AllDiscussionSummaries`
**Trigger:** Clicking "Discussion Summaries" from three-dot menu (Main Thread only)

### Layout
- Full viewport page

### Header Bar
- **"← Back" button**
- **Title:** "Discussion Summaries"

### Content
- Grouped by discussion
- Each discussion group:
  - Discussion title header
  - Summary cards (same as Screen 8 cards)
  - "No summaries yet" if empty

---

## SCREEN 10 — Project Settings

**File:** `components/ProjectWorkspace.jsx` → `Settings`
**Trigger:** Clicking "Settings" from three-dot menu

### Layout
- Full-screen overlay, background `rgba(0,0,0,0.8)`
- Centered modal: max-width 600px, max-height 90vh, scrollable, background surface, border, border-radius `12px`

### Header
- "Project Settings" — 20px, font-weight 600
- Close (×) button

### Body (padding `24px`)

#### Section: Project Information
- Title: "Project Information" — 16px, font-weight 600
- Row: "Title:" label + project title value (flex row, border-bottom)

#### Section: Invite Link
- Title: "Invite Link" — 16px, font-weight 600
- Description: "Share this link with team members"
- **Invite link display**: monospace URL + **Copy button** (green `#10a37f` background, clipboard/checkmark SVG)
- **Email invite** (below divider):
  - "Or send invitation via email:" label
  - Email input + **Send button** (`#8b5cf6`, disabled when empty or sending)

#### Section: Members
- Title: "Members (N)" — 16px, font-weight 600
- Member list:
  - Each member card (surface background, border, border-radius `8px`, padding `16px`, flex row):
    - 40×40px circle avatar (color from username hash) + initials
    - Username (14px, font-weight 600)
    - Role: "Owner" or "Member" (12px, muted, capitalized)

---

## MODAL F — Profile Settings

**File:** `components/ProfileModal.jsx`
**Trigger:** Clicking "Profile" in user dropdown

### Layout
- Full-screen overlay, background `rgba(0,0,0,0.8)`, z-index 10000
- Modal: max-width 600px, max-height 90vh, scrollable, background surface, border-radius `16px`, border

### Header
- "Profile Settings" — 20px, font-weight 600
- Close (×) button

### Content (padding `24px`)

#### Avatar Section (background, border, border-radius `12px`, padding `20px`)
- 64×64px circle avatar (color from username hash) + initials (24px)
- Username (18px, font-weight 600)
- Email (14px, secondary)

#### Stats Grid (3 columns)
- Each stat card (background, border, border-radius `10px`, padding `16px`, centered):
  - Value (20px, font-weight 600)
  - Label (12px, uppercase, muted)
  - Stats: Projects count, Messages count, Joined date

#### Tabs (border-bottom underline style)
- **Profile** tab
- **Password** tab (only shown for local auth users, not Google OAuth)

#### Tab: Profile Form
- **Username** input (required, maxLength=20)
- **Email** input
- **Bio** textarea (min-height 80px, resizable, maxLength=200, char counter "N/200" bottom-right)
- **Save Changes button** — full width, `#8b5cf6` (primary color), "Saving..." when loading

#### Tab: Password Form (local auth only)
- **Current Password** input (type=password, required)
- **New Password** input (type=password, required, minLength=6)
- **Confirm New Password** input (type=password, required)
- **Change Password button** — full width, `#8b5cf6`, "Changing..." when loading

---

## COMPONENT: Model Selector

**File:** `components/ModelSelector.jsx`
**Location:** Top-left of workspace header

### Trigger Button
- Background surface, border, border-radius `8px`, padding `8px 12px`
- Provider icon (SVG, 18×18, colored) + model name (14px, font-weight 500) + chevron-down SVG

### Dropdown (appears below button)
- Background surface, border, border-radius `12px`, min-width 360px, max-height 500px, scrollable, box-shadow

#### Search Input (top)
- Placeholder "Search models...", background darker, border-bottom, border-radius top corners, auto-focused

#### Provider List View (default)
- Each provider row (padding `12px 16px`):
  - Provider icon (colored SVG, 20×20)
  - Provider name (14px, font-weight 500)
  - "soon" badge (purple, uppercase, 10px) for coming-soon providers
  - **Settings gear icon button** (right, 18×18, muted) — opens API key modal
  - **Chevron-right icon button** (right, 18×18, muted) — navigates to model list
  - Coming-soon providers: opacity 0.45, not clickable
- Providers: OpenAI (green), Anthropic (tan), Google (multicolor), DeepSeek (blue, coming soon), xAI (white, coming soon), Server (purple)

#### Model List View (after clicking provider arrow)
- **"← Back to providers"** row (border-bottom, muted)
- Each model row (padding `12px 16px`):
  - Model name (14px)
  - Green checkmark SVG if currently selected
  - Hover highlight

### API Key Modal (triggered by settings icon)
- Overlay + modal, min-width 500px
- Header: "Set API Key for [Provider]" + close (×) button
- Description text (varies by provider, includes link to get API key)
- **API Key input** (type=password, placeholder)
- **Cancel button** + **Save Key button** (`#8b5cf6`, disabled when empty or submitting)

---

## COMPONENT: Sidebar

**File:** `components/Sidebar.jsx`
**Used in:** ProjectList and ProjectWorkspace

### Structure
- **Icon Bar** (always visible, 48px wide, fixed left, `#000000` background, z-index 1000):
  - Toggle button (40×40px): shows app logo icon normally, sidebar-toggle icon on hover
  - Slot for `iconBarContent` prop (additional buttons when sidebar is closed)
- **Sidebar Panel** (280px wide, fixed, left of icon bar, surface background, z-index 999, only when `isOpen=true`):
  - Scrollable content area (slot for `children` prop)
  - Footer (padding `16px`, border-top):
    - Slot for `footerContent` prop
    - User section button (avatar + name + email + chevron)
    - User dropdown (Profile, Theme toggle, Divider, Log out)

---

## COMPONENT: Error Boundary

**File:** `components/shared/ErrorBoundary.jsx`
**Trigger:** Any unhandled React error

### Layout
- Full viewport, background `#0d1117`, centered

### Elements
- ⚠️ emoji (64px)
- "Something went wrong" — 24px, font-weight 600, `#ececf1`
- Description text — 16px, `#8e8ea0`
- Dev-only collapsible error details (dark box, red monospace text)
- **Try Again button** — `#10a37f` green, padding `12px 24px`
- **Go Home button** — transparent, border `rgba(255,255,255,0.2)`, color `#ececf1`

---

## COMPONENT: Success Modal

**File:** `components/shared/SuccessModal.jsx`
**Usage:** Generic reusable success confirmation

### Elements
- Overlay (background `rgba(0,0,0,0.8)`, z-index 10000)
- Modal (max-width 400px, background `#1a1a1a`, border-radius `16px`, padding `40px`, centered text)
- 80×80px circle icon (`rgba(16,163,127,0.1)` bg, `#10a37f` checkmark SVG), `scaleIn` animation
- Title (24px, font-weight 600, `#ececec`)
- Message (16px, `#b4b4b4`, line-height 1.6)
- **Action button** — full width, `#10a37f`, 16px font-weight 600

---

## COMPONENT: Toast Notifications

**File:** `components/shared/Toast.jsx` + `react-toastify`
**Position:** Top-right, z-index 99999

### Toast types and colors
- success: `#10a37f` green
- error: `#ff6b6b` red
- warning: `#ffa500` orange
- info: `#4a9eff` blue

### Each toast
- Background `#1e1e1e`, border `rgba(255,255,255,0.1)`, border-radius `8px`, padding `16px`
- Left border `4px solid [type-color]`
- Icon (✓ / ✕ / ⚠ / ℹ) colored by type
- Message text (14px, `#ececf1`)
- Close (✕) button (muted)
- Slide-in from right animation, auto-close after 4 seconds

---

## COMPONENT: Project Intelligence Card

**File:** `components/ProjectIntelligenceCard.jsx`
**Location:** Dashboard left column (top)

### Elements
- Header: "Project Intelligence" (15px, font-weight 600) + stage badge (colored pill)
- Stage reason (13px, italic, muted)
- 4-metric grid (equal columns):
  - Momentum: trend icon + number, colored by trend
  - Blockers: count, red/green
  - Actions: count
  - Topics: count
- Footer: "Last decision: [date]" (12px, muted)

---

## COMPONENT: Decision Timeline

**File:** `components/DecisionTimeline.jsx`
**Location:** Dashboard left column

### Elements
- Vertical timeline (up to 10 items, newest first)
- Each item: green dot (10×10) + vertical line connector + decision text + metadata
- Expandable rationale on click

---

## COMPONENT: Blocker Tracker

**File:** `components/BlockerTracker.jsx`
**Location:** Dashboard right column

### Elements
- Each open blocker card: left border colored by severity + severity badge + text + topic badge + days-open indicator
- Empty state: "✓ No open blockers" in green

---

## Navigation Flow Summary

```
App Start
  └── Loading Screen
  └── Auth Screen (if not logged in)
        ├── Login form
        ├── Register form
        └── Google OAuth
  └── Onboarding (4 steps, first login only)
  └── Project List (home)
        ├── Sidebar: project list
        ├── Empty state with CTA buttons
        ├── Create Project Modal (2 steps)
        └── Join Project Modal (2 steps)
  └── Project Workspace (after selecting project)
        ├── Sidebar: discussion list
        ├── Chat view (default)
        │     ├── Message feed
        │     ├── AI thinking indicator
        │     ├── Mention popup (@CollabAI, @users)
        │     └── Input box with attach menu
        ├── Dashboard (owner only, full-page)
        │     ├── Health bar
        │     ├── Project Intelligence Card
        │     ├── Decision Timeline
        │     ├── Topic Distribution
        │     ├── Key Decisions
        │     ├── Action Items
        │     ├── Blocker Tracker
        │     ├── Stage Panel
        │     ├── Activity Chart
        │     ├── Discussion Activity
        │     ├── Message Distribution
        │     ├── Top Contributors
        │     └── Summary stats
        ├── Documents (full-page)
        ├── Summaries (full-page, per discussion)
        ├── All Discussion Summaries (full-page, main thread)
        └── Settings (modal overlay)

Modals (can appear on top of any screen):
  ├── Invite Confirm Modal (from URL invite link)
  ├── Create Discussion Modal
  ├── Invite to Discussion Modal (2 tabs)
  ├── Model Selector Dropdown + API Key Modal
  └── Profile Settings Modal (2 tabs)

Global:
  ├── Toast notifications (top-right)
  └── Error Boundary (catches crashes)
```

---

## Total Screen/View Count

| # | Screen/View | Type |
|---|---|---|
| 1 | Loading Screen | Full page |
| 2 | Auth — Login | Full page |
| 3 | Auth — Register | Full page (same component, toggled) |
| 4 | Onboarding (4 steps) | Full page overlay |
| 5 | Project List | Full page |
| 6 | Project Workspace — Chat | Full page |
| 7 | Project Workspace — Dashboard | Full page (replaces workspace) |
| 8 | Project Workspace — Documents | Full page (replaces workspace) |
| 9 | Project Workspace — Summaries | Full page (replaces workspace) |
| 10 | Project Workspace — All Summaries | Full page (replaces workspace) |
| 11 | Project Settings | Modal overlay |
| 12 | Profile Settings | Modal overlay |
| 13 | Create Project (step 1) | Modal |
| 14 | Create Project (step 2 — invite) | Modal |
| 15 | Join Project (form) | Modal |
| 16 | Join Project (success) | Modal |
| 17 | Invite Confirm (from URL) | Modal overlay |
| 18 | Create Discussion | Modal |
| 19 | Invite to Discussion | Modal (2 tabs) |
| 20 | Model Selector | Dropdown |
| 21 | API Key Setup | Modal |
| 22 | Error Boundary | Full page |
| 23 | Success Modal | Modal overlay |

**Total: 23 distinct UI states/screens**
