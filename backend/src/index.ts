import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

const startServer = async () => {
  const app = createApp();

  // Test database connection on startup
  try {
    await connectDatabase();
  } catch (error) {
    console.warn('⚠️ Starting server with database pending/unreachable:', error);
  }

  const server = app.listen(config.port, () => {
    console.log(`🚀 CertiFlow Server running on http://localhost:${config.port}`);
    console.log(`🩺 Health check at http://localhost:${config.port}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing HTTP server cleanly...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
