import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const directory = await mkdtemp(join(tmpdir(), 'student-grouper-tests-'));
const output = join(directory, 'domain-tests.mjs');

try {
  await build({
    entryPoints: ['tests/domain.test.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: output,
    logLevel: 'silent',
    plugins: [
      {
        name: 'external-native-wasm-loader',
        setup(builder) {
          builder.onResolve({ filter: /^highs$/ }, () => ({
            path: pathToFileURL(createRequire(import.meta.url).resolve('highs'))
              .href,
            external: true,
          }));
        },
      },
    ],
  });
  await import(pathToFileURL(output).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
