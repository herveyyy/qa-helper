## Faye v1.0.0

Floating QA assistant for pinning Livro Sprint Backlog (SPB) feedback on allowed sites.

### Install (Chrome / Edge / Brave)

1. Download **`faye-v1.zip`** from this release and unzip it.
2. Open the extensions page:
   - Chrome → `chrome://extensions`
   - Edge → `edge://extensions`
   - Brave → `brave://extensions`
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the unzipped folder that contains `manifest.json` (the built `dist` contents).
6. Confirm **Faye** appears and is enabled.

#### After updating

1. Rebuild/replace the unzipped folder (or download the new zip).
2. On the extensions page → **Faye** → **Reload**.
3. Hard-refresh the QA tab (`Ctrl+Shift+R`).

---

### First-time setup (QA)

1. Open an allowed site (default: `*.wela.dev`).
2. Click the floating **Faye** leaf button.
3. **Connect Livro** with ERP email/password (OTP if prompted), **or** use **Use current Desk session** if you already have `erp.livro.systems` open and signed in.
4. Open **Concerns** to see open Sprint Backlogs assigned to you.

Optional: Extensions → Faye → **Extension options** to set allowed sites and a custom icon.

---

### Features

#### Auth & session
- Explicit **Connect Livro** (no silent cookie reuse)
- Password login + OTP support
- **Use current Desk session** (sid from browser cookies)
- Session scoped to `https://erp.livro.systems` only

#### Concerns (Sprint Backlogs)
- List open SPBs where you are `current_assignee`
- Create a new concern/task from the widget
- Pick a concern, then pin UI feedback to a page element

#### Element picker & pins
- Click-to-pin element picker on the page
- Saved pin markers on matching page elements
- Click a pin to open its discussion (no accidental page navigation)
- Pins reload for the current page URL

#### Threaded comments
- Comment IDs for discussion/thread style
- Reply to a specific comment (with **Cancel** to clear reply target)
- Rich HTML comments (Frappe/Desk-style):
  - Bold / Italic / Underline / Strikethrough
  - Lists, quote, links
  - Image upload + paste
  - Active toolbar highlight for selected formats
  - Image preview + drag corner to resize
- Comments saved on the SPB timeline with Giya/Faye pin metadata

#### Resolve / DevOps status
- Shows **Not resolved** when `devops_status` is empty
- **Mark as resolve** sets DevOps Status to **For Staging Update**
- Shows current DevOps status when already set

#### UI / UX
- Monochrome light/dark themes (toggle in dock)
- Theme-aware Faye leaf FAB (white strokes on black FAB, black strokes on white FAB)
- Resizable dock panel (drag bottom-right)
- Environment / system specs capture with comments
- Profile panel + disconnect

#### Options
- Custom icon upload/URL
- Allowed sites list (widget only mounts on matching hosts)

---

### Requirements

- Chromium browser (Chrome, Edge, Brave, …) with Developer mode
- Livro ERP account on `erp.livro.systems`
- Access to a QA site in **Allowed sites** (default `wela.dev`)

---

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| No FAB on site | Confirm host is in Options → Allowed sites; reload extension + tab |
| “Connect Livro in Faye first” | Connect again from the widget |
| “Reload this page — Faye was updated” | Reload the extension, then hard-refresh the tab |
| Comment/image CSRF / 400 | Open Livro Desk once, reconnect in Faye, retry |
| Broken private images in old threads | Re-open the pin (Faye hydrates Livro files via session); new uploads are public for preview |

---

### Package

Attach/download: **`faye-v1.zip`** — unzip and Load unpacked.
