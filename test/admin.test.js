const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../index');

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });
}

function close(server) {
  return new Promise(resolve => {
    server.close(resolve);
  });
}

function url(server, path) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}${path}`;
}

test('admin status and kill switch flow', async t => {
  const app = createApp();
  const server = await listen(app);
  t.after(() => close(server));

  // 1. Check initial status
  const statusRes1 = await fetch(url(server, '/api/admin/status'));
  assert.equal(statusRes1.status, 200);
  const statusBody1 = await statusRes1.json();
  assert.equal(statusBody1.killed, false);

  // 2. Try to trigger kill with missing address
  const killResFail1 = await fetch(url(server, '/api/admin/kill'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(killResFail1.status, 400);
  const killFailBody1 = await killResFail1.json();
  assert.equal(killFailBody1.error, 'Admin address is required');

  // 3. Try to trigger kill with invalid address format
  const killResFail2 = await fetch(url(server, '/api/admin/kill'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminAddress: 'invalid-stellar-address' })
  });
  assert.equal(killResFail2.status, 400);
  const killFailBody2 = await killResFail2.json();
  assert.equal(killFailBody2.error, 'Invalid Stellar admin address format');

  // 4. Trigger kill with valid Stellar address
  const killResSuccess = await fetch(url(server, '/api/admin/kill'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
  });
  assert.equal(killResSuccess.status, 200);
  const killSuccessBody = await killResSuccess.json();
  assert.equal(killSuccessBody.ok, true);

  // 5. Verify status is now killed
  const statusRes2 = await fetch(url(server, '/api/admin/status'));
  assert.equal(statusRes2.status, 200);
  const statusBody2 = await statusRes2.json();
  assert.equal(statusBody2.killed, true);

  // 6. Resume/Reactivate
  const resumeRes = await fetch(url(server, '/api/admin/resume'), {
    method: 'POST'
  });
  assert.equal(resumeRes.status, 200);
  const resumeBody = await resumeRes.json();
  assert.equal(resumeBody.ok, true);

  // 7. Verify status is reset
  const statusRes3 = await fetch(url(server, '/api/admin/status'));
  assert.equal(statusRes3.status, 200);
  const statusBody3 = await statusRes3.json();
  assert.equal(statusBody3.killed, false);
});
