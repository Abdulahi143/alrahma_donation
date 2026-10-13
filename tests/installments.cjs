const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const scope = {};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/installments.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(scope);
const valid = { amountSek: 100, method: 'swish', paidOn: '2026-10-13', verified: true, requestId: '11111111-1111-1111-1111-111111111111' };
assert.equal(scope.installmentError(valid, '2026-10-13'), null);
for (const invalid of [{ amountSek: 1.5 }, { amountSek: 0 }, { paidOn: '2026-02-30' }, { paidOn: '2026-10-14' }, { verified: false }, { method: 'unknown' }, { requestId: 'invalid' }]) assert.ok(scope.installmentError({ ...valid, ...invalid }, '2026-10-13'));
console.log('Installment input, real dates and verification checks passed.');
