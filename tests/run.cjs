const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const file of fs.readdirSync(__dirname).filter(file => file.endsWith('.cjs') && file !== 'run.cjs').sort()) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
