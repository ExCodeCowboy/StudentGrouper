# Historical backup fixture

`backup-v0.1.0.json` was generated using the actual `createSampleData`, `normalizeAppData`, and `createBackupFile` implementations from commit `aeb12e7` (the 0.1.0 Mac-packaging release), retrieved from Git history. It contains only the application's fictional sample roster.

Before exporting, the fixture sets a fixed August 31, 2026 date, one absence, a group picture, a station picture, a valid student lock, a completed first round, and an ignored caution. Existing relationship notes and rotation locks are retained. Completed snapshots are produced by the old normalizer. No new block, station-rule, random-grouping, or presentation fields have been added.

Keep this file frozen rather than regenerating it from the current sample factory. The import test compares every saved field, checks re-export and re-import, and exercises the student display and a new planning block using the imported data.
