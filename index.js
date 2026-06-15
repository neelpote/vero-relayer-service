const express = require('express');
const { registerTaskOnChain } = require('./stellar');
const { registerMetrics, vero_events_processed_total, queue_latency_seconds } = require('./src/metrics/metrics');
const client = require('prom-client');

client.collectDefaultMetrics();
const vero_events_processed_total = new client.Counter({
  name: 'vero_events_processed_total',
  help: 'Total number of processed Vero events',
});
const queue_latency_seconds = new client.Histogram({
  name: 'queue_latency_seconds',
  help: 'Queue latency in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const app = express();
registerMetrics(app);
app.use(express.json());

app.post('/github-webhook', async (req, res) => {
  const { action, pull_request: pr } = req.body;

  if (action !== 'closed' || !pr?.merged) {
    return res.status(200).json({ skipped: true });
  }

  const hasLabel = pr.labels?.some(l => l.name === 'wave-contribution');
  if (!hasLabel) {
    return res.status(200).json({ skipped: true, reason: 'no wave-contribution label' });
  }

  const start = Date.now();
  console.log(`[webhook] PR #${pr.number} merged with wave-contribution label`);
  await registerTaskOnChain(pr.number);
  // Record metrics
  const durationSec = (Date.now() - start) / 1000;
  queue_latency_seconds.observe(durationSec);
  vero_events_processed_total.inc();
  res.status(200).json({ ok: true, pr: pr.number });
});

app.listen(3000, () => console.log('Server listening on port 3000'));
