# Database

There is a code block in ToAdd.md to be added to classify function whether directly to scanner.py or any main.py before running all this. 

## What gets logged

Every time `POST /api/classify` succeeds, a row is saved with the scanner's
result plus an estimated carbon footprint:

| Column | Type | Description |
|---|---|---|
| `id` | integer | Auto-incrementing primary key |
| `item_name` | text | What the scanner identified (e.g. "plastic water bottle") |
| `material_type` | text | e.g. "plastic", "metal", "glass" |
| `nyc_stream_category` | text | NYC DSNY collection stream |
| `bin_color` | text | Which curbside bin it belongs in |
| `is_recyclable` | boolean | Whether it's recyclable under NYC rules |
| `preparation_instructions` | JSON | List of prep steps (e.g. "rinse before recycling") |
| `nyc_rule_notes` | text | Notes on the applicable rule |
| `carbon_saved_kg` | float | Estimated CO2e saved by recycling this item |
| `created_at` | datetime | Timestamp of when it was scanned |

## How it's set up in code

- **`database.py`** — creates the SQLite connection (`engine`) and a
  `get_db()` function that hands each API request its own database session,
  then closes it automatically when the request finishes.
- **`models.py`** — defines the `classifications` table as a Python class
  (SQLAlchemy ORM), matching the columns above.
- **`main.py`** — calls `Base.metadata.create_all(bind=engine)` on startup,
  which creates the table if it doesn't already exist. Each `/api/classify`
  call then adds one row.

## Checking the database


**Command line** (built into Mac/Linux, downloadable on Windows):
```bash
cd server
sqlite3 classifications.db
.headers on
.mode column
SELECT * FROM classifications;
.quit
```

**GUI, cross-platform (Windows/Mac/Linux)** — [DB Browser for SQLite](https://sqlitebrowser.org/dl/):
open the app → "Open Database" → select `server/classifications.db`. Gives you
a spreadsheet-style table view and a place to run SQL queries, similar to Adminer.

**VS Code:** install the "SQLite Viewer" extension, then click
`classifications.db` in the file explorer to view it inline.

## Resetting the database

Just delete the file and restart the server — the table gets recreated empty:
```bash
rm classifications.db
uvicorn main:app --reload
```

## Useful queries

```sql
-- most recent scans first
SELECT * FROM classifications ORDER BY created_at DESC LIMIT 10;

-- total carbon saved so far
SELECT SUM(carbon_saved_kg) FROM classifications;

-- how many items were recyclable vs not
SELECT is_recyclable, COUNT(*) FROM classifications GROUP BY is_recyclable;

-- breakdown by material type
SELECT material_type, COUNT(*) FROM classifications GROUP BY material_type;
```

## Notes

- Each person running the backend locally has their **own separate** `classifications.db`
  — it's not shared automatically. If the team wants one shared history, someone
  needs to run a single backend instance that everyone's frontend points to.
- The file is not meant to be committed to git — it fills up with local test data.
  Make sure `server/classifications.db` is listed in `.gitignore`.
- Fine for a hackathon / single demo instance. If this ever needs to run as a real
  shared multi-user service, migrating to Postgres later is straightforward since
  the schema (via SQLAlchemy) barely changes — just the connection string.