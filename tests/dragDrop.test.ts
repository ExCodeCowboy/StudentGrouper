import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { readDrag, writeDrag } from '../src/dragDrop';

void test('WebKit text fallback preserves the kind of dragged item', () => {
  const data = new Map<string, string>();
  const transfer = {
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    setData: (key: string, value: string) => {
      data.set(key, value);
    },
    getData: (key: string) => data.get(key) ?? '',
  };
  for (const kind of ['student', 'group', 'station'] as const) {
    data.clear();
    writeDrag(transfer, kind, 'some-id');
    assert.equal(transfer.effectAllowed, 'move');
    assert.equal(readDrag(transfer, kind), 'some-id');
    data.delete(`application/x-${kind}-id`);
    assert.equal(readDrag(transfer, kind), 'some-id');
    assert.equal(
      readDrag(transfer, kind === 'student' ? 'station' : 'student'),
      '',
    );
  }
  data.set('text/plain', 'unrelated text');
  assert.equal(readDrag(transfer, 'group'), '');
});

void test('desktop window leaves browser drop events to the application', () => {
  const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  assert.ok(
    config.app.windows.every(
      (window: { dragDropEnabled?: boolean }) =>
        window.dragDropEnabled === false,
    ),
  );
});
