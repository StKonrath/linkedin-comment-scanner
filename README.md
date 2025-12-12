# 🔍 LinkedIn Comments Scanner

**Find high-engagement LinkedIn posts in seconds, not hours.**

A browser bookmarklet that automatically scrolls through your LinkedIn feed and collects posts with 100+ comments (or any threshold you choose). Perfect for content creators, marketers, and researchers who want to study what makes posts go viral.

![Version](https://img.shields.io/badge/version-0.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome-lightgrey)

---

## ✨ Features

- 🚀 **Auto-scroll** through your entire LinkedIn feed
- 🎯 **Adjustable threshold** — filter for 20, 50, 100, 200, or 500+ comments
- 🌍 **Multi-language support** — works on DE, EN, FR, ES, IT, NL, PT LinkedIn
- 📋 **One-click export** — copy to clipboard or download as CSV
- 💾 **Remembers your settings** — threshold persists across sessions
- 🔘 **Smart button detection** — auto-clicks "Show new posts" button
- 📱 **Preview snippets** — see post content without leaving the scanner

---

## 🎬 Demo

```
┌─────────────────────────────────────────────────────┐
│ Comments Scanner v0.6.0                        [−][✕]│
├─────────────────────────────────────────────────────┤
│ Scroll #47 — Found 2 new | Total: 12                │
│                                                     │
│ Min. Comments: [20] [50] [100] [200] [500]          │
│                          ^^^                        │
│ [Pause] [Clipboard] [CSV Download] [Hide posts]     │
│                                                     │
│ ➜ Open Post ID: 7405184958337753088 — 234 comments  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Post preview snippet]                          │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Option 1: Bookmarklet (Recommended)

1. Copy the entire content of [`linkedin-comment-scanner-bookmarklet.txt`](./linkedin-comment-scanner-bookmarklet.txt)
2. Create a new bookmark in your browser
3. Paste the code as the bookmark URL
4. Name it "LinkedIn Scanner" (or whatever you like)

### Option 2: Browser Console

1. Open [linkedin.com/feed](https://www.linkedin.com/feed/)
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Paste the content of [`linkedin-comments-scanner-v0.6.0.js`](./linkedin-comments-scanner-v0.6.0.js)
5. Press Enter

---

## 🚀 Usage

1. Go to your [LinkedIn Feed](https://www.linkedin.com/feed/)
2. Click the bookmarklet (or run the script)
3. The scanner overlay appears in the top-right corner
4. **Set your threshold** — click 20, 50, 100, 200, or 500
5. **Let it run** — the scanner auto-scrolls and collects posts
6. **Export results** — click "Clipboard" or "CSV Download"

### Controls

| Button | Action |
|--------|--------|
| `Pause` / `Resume` | Stop or continue auto-scrolling |
| `Clipboard` | Copy all results to clipboard |
| `CSV Download` | Download results as CSV file |
| `Hide posts` / `Show posts` | Toggle post preview snippets |
| `−` | Minimize the overlay |
| `✕` | Close the scanner |

---

## 📊 Export Format

### Clipboard
```
Post ID: 7405184958337753088 — https://www.linkedin.com/feed/update/urn:li:activity:7405184958337753088 — 234 comments
Post ID: 7404821234567890123 — https://www.linkedin.com/feed/update/urn:li:activity:7404821234567890123 — 156 comments
```

### CSV
```csv
"Post ID","URL","Comments"
"7405184958337753088","https://www.linkedin.com/feed/update/urn:li:activity:7405184958337753088","234"
"7404821234567890123","https://www.linkedin.com/feed/update/urn:li:activity:7404821234567890123","156"
```

---

## ⚙️ Configuration

The scanner stores your preferences in `localStorage`:

| Key | Default | Description |
|-----|---------|-------------|
| `scannerCommentThreshold` | `100` | Minimum comments to include |
| `scannerOverlayPosition` | `right` | Overlay position (left/right) |

---

## 🌍 Supported Languages

The scanner detects comment counts in these languages:

| Language | Button Label |
|----------|--------------|
| 🇩🇪 German | "Kommentare" |
| 🇬🇧 English | "comments" |
| 🇫🇷 French | "commentaires" |
| 🇪🇸 Spanish | "comentarios" |
| 🇮🇹 Italian | "commenti" |
| 🇳🇱 Dutch | "reacties" |
| 🇵🇹 Portuguese | "comentários" |

---

## 🛠️ Technical Details

- **No dependencies** — pure vanilla JavaScript
- **No data collection** — everything stays in your browser
- **No API calls** — just DOM manipulation
- **~16KB minified** — lightweight bookmarklet

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 85+ | ✅ Tested |
| Firefox | 78+ | ✅ Should work |
| Edge | 85+ | ✅ Should work |
| Safari | 14+ | ⚠️ Untested |

---

## 🤔 FAQ

**Q: Is this against LinkedIn's Terms of Service?**  
A: This tool only reads publicly visible data from your own feed. It doesn't scrape profiles, bypass logins, or access private data. Use responsibly.

**Q: Why does it pause sometimes?**  
A: LinkedIn loads content dynamically. The scanner waits for new posts to load and retries up to 3 times before pausing. Just click "Resume" to continue.

**Q: Can I change the scroll speed?**  
A: Edit `SCROLL_INTERVAL_MS` in the source code (default: 4000ms = 4 seconds).

**Q: Why are some posts missing?**  
A: LinkedIn's feed is personalized and infinite. The scanner can only find posts that appear in your feed during the scan.

---

## 🗺️ Roadmap

- [ ] Custom threshold input (any number)
- [ ] Filter by post author
- [ ] Date range filter
- [ ] Dark mode
- [ ] Browser extension version

---

## 💖 Support This Project

If this tool saves you time, consider supporting its development:

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-red?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/StKonrath)

Your sponsorship helps:
- ☕ Keep the tool free and open-source
- 🚀 Fund new features
- 🐛 Priority bug fixes
- 🌍 Support more languages

---

## 📄 License

MIT License — do whatever you want, just don't blame me if something breaks.

---

## 🙏 Acknowledgments

Built with caffeine and curiosity.

---

**Found a bug?** [Open an issue](https://github.com/YOUR_USERNAME/linkedin-comments-scanner/issues)  
**Have an idea?** [Start a discussion](https://github.com/YOUR_USERNAME/linkedin-comments-scanner/discussions)  
**Want to contribute?** PRs welcome!
