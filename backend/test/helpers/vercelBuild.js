// Compiles the backend the way Vercel does (@vercel/backends: rolldown, one .cjs per source file,
// only package.json dependencies kept external) so tests exercise the code that really runs there.
const path = require('path');
const fs = require('fs');
const os = require('os');

async function buildLikeVercel() {
  const { rolldown } = await import('rolldown');
  const workPath = path.join(__dirname, '..', '..');
  const repoRoot = path.dirname(workPath);
  const pkg = JSON.parse(fs.readFileSync(path.join(workPath, 'package.json'), 'utf8'));
  const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivra-vercel-'));
  const bundle = await rolldown({ input: path.join(workPath, 'server.js'), cwd: workPath, platform: 'node', external });
  const { output } = await bundle.write({
    dir: outDir, format: 'cjs', entryFileNames: '[name].cjs', preserveModules: true, preserveModulesRoot: repoRoot, sourcemap: false,
  });
  await bundle.close();

  const compiledBackend = path.join(outDir, path.basename(workPath));
  fs.symlinkSync(path.join(workPath, 'node_modules'), path.join(compiledBackend, 'node_modules'), 'dir');
  return { outDir, compiledBackend, files: output.filter(o => o.type === 'chunk').map(o => o.fileName) };
}

module.exports = { buildLikeVercel };
