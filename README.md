# Sylva Weekly Product Report

A self-contained web app for weekly trial-to-subscription drop-off analysis. No npm, no server — just open `index.html` in a browser.

## Quick Start

1. Open `index.html` in any modern browser
2. Drag and drop your weekly CSV exports onto the upload zone
3. Set the week label (auto-detected as current ISO week)
4. Click "Analyse" to process all data
5. View the interactive dashboard
6. Export as Word document (.docx) or JSON

## Features

- **Auto-classification**: Identifies 10 CSV data source types by column structure
- **Chat Digest analysis**: Per-user profiling, trial vs paid segmentation, engagement gaps
- **UXCam analysis**: Subscription funnel (6-step drop-off), screen metrics, from_page analysis
- **RevenueCat analysis**: Conversion rates, retention cohorts, MRR, active subscriptions
- **Blocker identification**: Value delivery, awareness, pricing/timing, trial expiration
- **Priority actions**: P0/P1/P2 recommendations with owner, timeline, expected impact
- **Sanity checks**: Cross-source validation
- **Persistent storage**: IndexedDB stores all weekly analyses in the browser
- **Word document export**: Full .docx report via docx.js
- **Dark theme dashboard**: 5 tabs — Trial Cohort, Engagement Gap, Subscription Funnel, Retention, Actions

## Supported Data Sources

| Data Source | How It's Identified |
|---|---|
| Chat Digests | User ID, Timestamp, Subscription status |
| UXCam Events | sessionid, eventname, trackedon, uxcamuserid |
| UXCam Users | uxcamuserid, totalsession, totalsessiontime |
| UXCam Sessions | sessionid, uxcamuserid, totalsessiontime, recordedon |
| UXCam Screens | totalsession, screen_name |
| RevenueCat Conversion | Project + Total/Total.1/Total.2 triples with % values |
| RevenueCat Retention | Cohort, Subscriptions, Month 1...12 |
| RevenueCat Active Subs | Project, Total, Sylva (integer counts) |
| RevenueCat MRR | Project, Total, Sylva (monetary values) |
| RevenueCat New Customers | Project + triples (weekly counts) |

Multiple Chat Digest files are handled automatically — the one with the most rows is selected.

## How Data Is Stored

All analysis data is stored in your browser's IndexedDB. Nothing is sent to any server. Previous weeks' reports are accessible from the upload screen.

## Dependencies (loaded via CDN)

- React 18
- Babel Standalone (JSX transformation)
- docx 9.1.1 (Word document generation)
- FileSaver.js (file download)
- IBM Plex Sans (Google Fonts)
