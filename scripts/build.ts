const output = 'dist';

for await (const path of new Bun.Glob(`${output}/*`).scan())
  await Bun.file(path).delete();

const build = await Bun.build({
  entrypoints: ['index.html'],
  outdir: output,
  minify: true,
  target: 'browser',
  external: ['*.webmanifest', '*.svg', '*.png'],
});

if (!build.success)
  throw new AggregateError(build.logs, 'Build failed');

const staticFiles = [
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'service-worker.js',
];

for (const path of staticFiles)
  await Bun.write(`${output}/${path}`, Bun.file(path));

console.log(`Built ${build.outputs.length} bundled and ${staticFiles.length} static files.`);
