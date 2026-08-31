# Student Grouper

Student Grouper is a local-first classroom tool for building student groups and continuing station rotations across multiple days. It is designed to be quick to operate on a 13-inch laptop and to produce pictographic rotation charts for young readers.

## Current application

- Paste a class roster and edit language, gender, reading, math, and writing information.
- Add simple “prefer together” and “keep apart” grouping notes.
- Save multiple group arrangements.
- Generate mixed or similar skill groups with an optional gender or language preference.
- Drag only the student you want to move; that placement locks without moving anyone else.
- Edit rotations by station or by group.
- Drag a rotation assignment to implicitly lock it.
- Fill empty schedule cells without changing placed work, or explicitly rebuild only unlocked future work.
- Choose different station lineups for different days.
- Mark completed rounds so later days continue from each learner’s actual station history, even after regrouping.
- Add custom GIF, JPG, or PNG station pictures.
- Print a landscape chart with group symbols, station pictures, and station words.
- Automatically save locally and export or restore a complete backup.

## Development

```text
npm install
npm run dev
```

Validation:

```text
npm run test
npm run lint
npm run build
```

## Mac packaging boundary

The application is intentionally a static Vite/React build. It has no server routes, hosted database, cloud bindings, or Node-only code in the product interface. `npm run build` produces the complete interface in `dist/`.

Local persistence sits behind `PersistencePort` in `src/storage.ts`. The current implementation uses IndexedDB, which also works inside a macOS webview. A future Tauri wrapper can initially package the existing `dist/` output unchanged. If native file storage is later desired, only the persistence adapter needs to change; the data model, grouping engine, rotation engine, screens, printing layout, and image workflow remain the same.

Mac packaging is deliberately not configured yet. That phase should add the native shell, app identity, icon, signing/notarization settings, and Mac-specific print verification without rebuilding the product.
