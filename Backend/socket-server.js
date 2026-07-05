import http from 'http';
import express from 'express';
import { config } from './src/config/env.js';
import { connectRedis, closeRedis } from './src/config/redis.js';
import { initSocket } from './src/config/socket.js';
import { logger } from './src/utils/logger.js';
import { loadEnvFromDb } from './src/config/envLoader.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { initializeFirebaseRealtime } from './src/config/firebase.js';

const app = express();

// Healthcheck route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'socket', port: config.socketPort || 5001 });
});

const startSocketServer = async () => {
    try {
        await connectDB();
        await loadEnvFromDb();
        initializeFirebaseRealtime();

        const httpServer = http.createServer(app);

        if (config.redisEnabled) {
            await connectRedis();
        }

        await initSocket(httpServer);

        const port = config.socketPort || 5001;
        httpServer.listen(port, config.host || '127.0.0.1', () => {
            logger.info(`Dedicated Socket.IO Server running on ${config.host || '127.0.0.1'}:${port}`);
        });

        const shutdown = async () => {
            logger.info('Shutting down Socket.IO Server');
            httpServer.close(async () => {
                await disconnectDB();
                if (config.redisEnabled) {
                    await closeRedis();
                }
                process.exit(0);
            });
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        logger.error(`Socket Server startup error: ${err.message}`);
        process.exit(1);
    }
};

startSocketServer();

