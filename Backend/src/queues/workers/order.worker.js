import 'dotenv/config';
import { Worker } from 'bullmq';
import { config } from '../../config/env.js';
import { connectDB, disconnectDB } from '../../config/db.js';
import { loadEnvFromDb } from '../../config/envLoader.js';
import { initializeFirebaseRealtime } from '../../config/firebase.js';
import { logger } from '../../utils/logger.js';
import { connectRedis, closeRedis, getRedisClient } from '../../config/redis.js';
import { initRedisEmitter } from '../../config/socket.js';
import { getBullMQConnection } from '../connection.js';
import { ORDER_QUEUE } from '../queue.constants.js';
import { processOrderJob } from '../processors/order.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startOrderWorker = async () => {
    if (!config.bullmqEnabled) {
        logger.info('BullMQ is disabled. Order worker not started.');
        return null;
    }

    logger.info(`[Bootstrap] Starting order worker bullmqEnabled=${config.bullmqEnabled} redisEnabled=${config.redisEnabled}`);

    await connectDB();
    await loadEnvFromDb();
    initializeFirebaseRealtime();
    logger.info('[Bootstrap] Order worker initialized MongoDB, env overrides, and Firebase');

    if (config.redisEnabled) {
        logger.info('[Bootstrap] Order worker connecting Redis client for socket emitter support');
        const redisClient = await connectRedis();
        initRedisEmitter(redisClient || getRedisClient());
    } else {
        logger.warn('[Bootstrap] Order worker started without Redis emitter support; socket broadcasts from worker will be unavailable');
    }

    const connection = getBullMQConnection();
    if (!connection) {
        logger.error('Order worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(ORDER_QUEUE, processOrderJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => logger.info(`Order job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Order job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => logger.error(`Order worker error: ${err.message}`));
    logger.info('Order worker started');
    return worker;
};

const worker = await startOrderWorker();
if (worker) {
    const shutdown = async () => {
        await worker.close();
        await closeRedis();
        await disconnectDB();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
