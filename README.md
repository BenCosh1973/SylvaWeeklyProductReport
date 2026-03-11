# Sylva Weekly Product Report

Automated weekly data ingestion, analysis, and reporting for Sylva's trial-to-subscription conversion funnel.

## Quick Start

```bash
npm install

# 1. Place CSV exports in data/incoming/
# 2. Run the full pipeline:
npm run run

# Or run steps individually:
npm run ingest      # Classify and archive CSVs
npm run analyze     # Process all data sources
npm run report      # Generate dashboard + Word doc
```

## How It Works

### Data Ingestion
Drop your weekly CSV exports into `data/incoming/`. The classifier automatically identifies each file type by its column structure:

| Data Source | Key Columns |
|---|---|
| Chat Digests | User ID, Timestamp, Subscription status, CSAT, Message Count |
| UXCam Events | sessionid, eventname, property, uxcamuserid |
| UXCam Users | uxcamuserid, totalsession, u__subscriptionstatus |
| UXCam Sessions | sessionid, uxcamuserid, totalsessiontime, ragegesturecount |
| UXCam Screens | totalbounce, totalengagementtimemedian, screen_name |
| RevenueCat Conversion | Project, Total/Total.1/Total.2 triples |
| RevenueCat Retention | Cohort, Subscriptions, Month 1...12 |
| RevenueCat Active Subs | Project, Total, Sylva, Rowan, Hazel |
| RevenueCat MRR | Same structure with monetary values |
| RevenueCat New Customers | Same structure with weekly counts |

Multiple Chat Digest files are handled automatically — the one with the most rows is selected.

### Storage
- Raw CSVs archived by week in `data/archive/YYYY-WNN/`
- Processed analysis stored as JSON in `data/store/`
- Full history maintained for trend tracking

### Reports

**Interactive Dashboard** (`output/YYYY-WNN/sylva-dashboard-*.html`)
- Dark theme React dashboard with 5 tabs
- Trial Cohort: user segments, sortable detail table
- Engagement Gap: trial vs paid comparison with key insights
- Subscription Funnel: step-by-step drop-off analysis
- Retention: cohort survival curves, benchmark comparison
- Actions: prioritised recommendations with P0/P1/P2 badges

**Word Document** (`output/YYYY-WNN/sylva-report-*.docx`)
- Executive Summary
- Trial User Engagement Profile
- Paid User Success Pattern
- Engagement Gap Analysis
- Subscription Sub-Funnel
- Retention Cohort Analysis
- Conversion Blockers
- Priority Actions
- Appendix (user IDs for UXCam review)

## CLI Options

```bash
# Specify input directory
node src/index.js all --dir /path/to/csvs

# Specify week label
node src/index.js all --week 2026-W11

# View ingestion history
node src/index.js history
```

## Directory Structure

```
├── src/
│   ├── index.js              # CLI orchestrator
│   ├── ingest/
│   │   ├── classifier.js     # CSV type classification
│   │   └── ingestor.js       # File ingestion & archival
│   ├── analysis/
│   │   ├── csvReader.js      # CSV parsing utilities
│   │   ├── chatDigest.js     # Chat digest analysis (Steps 2-4)
│   │   ├── uxcam.js          # UXCam analysis (Steps 5-6)
│   │   ├── revenuecat.js     # RevenueCat analysis (Step 7)
│   │   ├── blockers.js       # Blocker identification (Step 9)
│   │   └── sanityChecks.js   # Data validation (Step 12)
│   ├── storage/
│   │   └── store.js          # JSON-based persistence
│   └── report/
│       ├── dashboard.jsx     # React dashboard component
│       ├── buildDashboard.js # HTML builder
│       └── docxReport.js     # Word document generator
├── data/
│   ├── incoming/             # Drop CSVs here
│   ├── archive/              # Weekly archives
│   └── store/                # Processed analysis JSON
└── output/                   # Generated reports
```
