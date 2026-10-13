const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let rows, calls, outcome, monthlyDetails;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.limitCount = Infinity; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
  order() { return this; }
  limit(count) { this.limitCount = count; return this; }
  update(patch) { this.patch = patch; return this; }
  execute(single) {
    const data = rows[this.table].filter(row => this.filters.every(f => f(row))).slice(0, this.limitCount);
    if (this.patch) data.forEach(row => Object.assign(row, this.patch));
    return { data: single ? data[0] || null : data.map(row => ({ ...row })), error: null };
  }
  single() { return Promise.resolve(this.execute(true)); }
  maybeSingle() { return this.single(); }
  then(resolve, reject) { return Promise.resolve(this.execute(false)).then(resolve, reject); }
}
const scope = {};
const code = ts.transpileModule(fs.readFileSync('lib/notifications.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', 'require', code)(scope, name => {
  if (name === './supabase/server') return { supabaseAdmin: () => ({ from: table => new Query(table), rpc: async name => ({ data: name === 'pending_whatsapp_notifications' ? rows.notification_queue.filter(row => row.status === 'queued').map(row => ({ ...row })) : monthlyDetails, error: null }) }) };
  if (name === './broadcast') return { providerStatus: () => ({ whatsapp: true }), sendWhatsApp: async (...args) => { calls.push(args); return outcome; } };
  if (name === './communication') return { recipientAddress: donor => donor.comm_whatsapp && !donor.comm_opt_out ? donor.phone : null };
  throw new Error(name);
});
function reset() {
  process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'true';
  calls = []; outcome = { ok: true, messageId: 'test-message' }; monthlyDetails = { amount: 60, reference: 'AR-PLAN' };
  rows = {
    campaign_settings: [{ id: 'main', is_live: true }],
    notification_queue: [{ id: 'q', donor_id: 'd', donation_id: 'n', template_id: 'pledge_reminder', language: 'sv', status: 'queued' }],
    notification_templates: [{ id: 'pledge_reminder', language: 'sv', approval_status: 'approved', provider_name: 'reminder_sv', provider_language: 'sv' }],
    donors: [{ id: 'd', phone: '+46700000000', preferred_language: 'sv', comm_whatsapp: true, comm_opt_out: false }],
    donations: [{ id: 'n', donor_id: 'd', status: 'pending', amount_sek: 120, reference: 'AR-TEST', created_at: new Date(Date.now() - 8 * 86400000).toISOString() }],
    payment_plans: [{ id: 'p', donor_id: 'd' }]
  };
}
(async () => {
  reset();
  const simultaneous = await Promise.all([scope.processNotifications(), scope.processNotifications()]);
  assert.equal(calls.length, 1);
  assert.equal(simultaneous.reduce((sum, result) => sum + result.accepted, 0), 1);
  assert.deepEqual(calls[0].slice(1), ['reminder_sv', 'sv', ['120', 'AR-TEST']]);
  assert.equal(rows.notification_queue[0].provider_message_id, 'test-message');
  reset(); rows.donors[0].comm_opt_out = true;
  assert.equal((await scope.processNotifications()).cancelled, 1); assert.equal(calls.length, 0);
  reset(); rows.donations[0].status = 'confirmed';
  assert.equal((await scope.processNotifications()).cancelled, 1); assert.equal(calls.length, 0);
  reset(); rows.donations[0].payment_plan_id = 'p';
  assert.equal((await scope.processNotifications()).cancelled, 1); assert.equal(calls.length, 0);
  reset(); rows.notification_templates[0].approval_status = 'draft';
  await scope.processNotifications(); assert.equal(calls.length, 0); assert.equal(rows.notification_queue[0].status, 'queued');
  reset(); outcome = { ok: false, error: 'Provider connection failed' };
  await scope.processNotifications(); await scope.processNotifications();
  assert.equal(rows.notification_queue[0].status, 'sending'); assert.equal(calls.length, 1);
  reset(); process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'false';
  assert.equal((await scope.processNotifications()).disabled, true); assert.equal(calls.length, 0);
  reset(); rows.campaign_settings[0].notifications_paused = true;
  assert.equal((await scope.processNotifications()).disabled, true); assert.equal(calls.length, 0);
  reset(); rows.donors[0].reminders_paused = true;
  await scope.processNotifications(); assert.equal(calls.length, 0); assert.equal(rows.notification_queue[0].status, 'queued');
  reset();
  Object.assign(rows.notification_queue[0], { template_id: 'plan_reminder', plan_id: 'p', donation_id: null, installment_number: 1 });
  rows.notification_templates[0].id = 'plan_reminder';
  assert.equal((await scope.processNotifications()).accepted, 1);
  assert.deepEqual(calls[0][3], ['60', 'AR-PLAN']);
  assert.equal(rows.notification_queue[0].amount_due, 60);
  reset();
  Object.assign(rows.notification_queue[0], { template_id: 'plan_reminder', plan_id: 'p', donation_id: null, installment_number: 1 });
  rows.notification_templates[0].id = 'plan_reminder'; monthlyDetails = null;
  assert.equal((await scope.processNotifications()).cancelled, 1); assert.equal(calls.length, 0);
  reset();
  Object.assign(rows.notification_queue[0], { template_id: 'plan_reminder', plan_id: 'p', donation_id: null, installment_number: 1 });
  rows.notification_templates[0].id = 'plan_reminder'; monthlyDetails = { waiting: true };
  await scope.processNotifications(); assert.equal(rows.notification_queue[0].status, 'queued'); assert.equal(calls.length, 0);
  console.log('Queue claiming, consent, stale reminders, template parameters and uncertain-send checks passed. No messages sent.');
})().catch(error => { console.error(error); process.exitCode = 1; });
