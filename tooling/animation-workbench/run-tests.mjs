import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

for (const filename of ['model.test.ts', 'catAdapter.test.ts']) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(filename, import.meta.url))],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const code = `${result.outputFiles[0].text}\n//# sourceURL=animation-workbench-${filename}.mjs`;
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
