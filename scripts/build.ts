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

let staticFiles = 0;

for await (const path of new Bun.Glob('public/*').scan()) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  await Bun.write(`${output}/${name}`, Bun.file(path));
  staticFiles += 1;
}

console.log(`Built ${build.outputs.length} bundled and ${staticFiles} static files.`);
