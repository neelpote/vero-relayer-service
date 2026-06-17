const express = require('express');
const {
  buildGitHubPullRequestEventPayload,
  buildMetadataFromRequest,
  enqueueEvent,
  validateRedisConfig
} = require('./src/queue');
const { verifySignature } = require('./src/middleware/auth');
const { registerMetrics } = require('./src/metrics/metrics');
const { logger } = require('./src/logger');
const { startConfigPoller } = require('./src/services/config-poller');
const path = require('path');
const { generateCallGraph } = require('./src/services/call-graph');

function createApp(options = {}) {
  const enqueueEventJob = options.enqueueEventJob || enqueueEvent;
  const app = express();

  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));

  registerMetrics(app);

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.get('/api/contract-calls', (req, res) => {
    try {
      const graph = generateCallGraph(path.join(__dirname, 'contracts'));
      res.json(graph);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to generate contract call graph');
      res.status(500).json({ error: 'Failed to generate contract call graph' });
    }
  });

  let contractKilled = false;

  app.get('/api/admin/status', (req, res) => {
    res.json({ killed: contractKilled });
  });

  app.post('/api/admin/kill', (req, res) => {
    const { adminAddress } = req.body;
    if (!adminAddress || adminAddress.trim() === '') {
      return res.status(400).json({ error: 'Admin address is required' });
    }

    const stellarAddressRegex = /^G[A-Z2-7]{55}$/;
    if (!stellarAddressRegex.test(adminAddress)) {
      return res.status(400).json({ error: 'Invalid Stellar admin address format' });
    }

    contractKilled = true;
    logger.warn({ adminAddress }, 'Admin triggered contract kill switch');
    res.json({ ok: true, message: 'Contract successfully killed' });
  });

  app.post('/api/admin/resume', (req, res) => {
    contractKilled = false;
    logger.info('Contract kill switch reset, service active');
    res.json({ ok: true, message: 'Contract successfully reactivated' });
  });

  // Serve static files from Vite's build directory
  app.use(express.static(path.join(__dirname, 'dist')));

  // Fallback to index.html for SPA frontend routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/metrics') {
      return next();
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  app.post('/github-webhook', verifySignature, async (req, res) => {
    const { action, pull_request: pr } = req.body;

    if (action !== 'closed' || !pr?.merged) {
      return res.status(200).json({ skipped: true });
    }

    const hasLabel = pr.labels?.some(l => l.name === 'wave-contribution');
    if (!hasLabel) {
      return res.status(200).json({ skipped: true, reason: 'no wave-contribution label' });
    }

    const eventPayload = buildGitHubPullRequestEventPayload(req.body, buildMetadataFromRequest(req));

    try {
      const job = await enqueueEventJob(eventPayload);
      logger.info({ pr: pr.number, eventType: eventPayload.eventType, jobId: job.id }, '[webhook] queued PR event');
      return res.status(202).json({ ok: true, pr: pr.number, queued: true, jobId: job.id });
    } catch (error) {
      logger.error({ pr: pr.number, error: error.message }, '[webhook] failed to enqueue PR');
      return res.status(500).json({ ok: false, error: 'failed to enqueue event' });
    }
  });

  return app;
}

function startServer() {
  validateRedisConfig();
  startConfigPoller();

  const port = process.env.PORT || 3000;
  const app = createApp();

  return app.listen(port, () => logger.info({ port }, 'Server listening on port'));
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
