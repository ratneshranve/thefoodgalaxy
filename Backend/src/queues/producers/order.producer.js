import { getOrderQueue } from '../index.js';
import { logger } from '../../utils/logger.js';

/** @type {Map<string, NodeJS.Timeout>} */
const pendingFallbackTimers = new Map();

/**
 * Build a stable job id for dispatch timeout checks so only one pending job exists per order.
 * @param {string} orderMongoId
 */
export function dispatchTimeoutJobId(orderMongoId) {
    return `dispatch-timeout-${String(orderMongoId)}`;
}

/**
 * Cancel a pending dispatch timeout job (BullMQ or setTimeout fallback).
 * @param {string} orderMongoId
 */
export async function cancelDispatchTimeoutJob(orderMongoId) {
    const jobId = dispatchTimeoutJobId(orderMongoId);
    const queue = getOrderQueue();

    const fallbackTimer = pendingFallbackTimers.get(jobId);
    if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        pendingFallbackTimers.delete(jobId);
    }

    if (!queue) return;

    try {
        const existing = await queue.getJob(jobId);
        if (!existing) return;
        const state = await existing.getState();
        if (['delayed', 'waiting', 'paused'].includes(state)) {
            await existing.remove();
            logger.info(`Removed pending dispatch timeout job ${jobId} (state=${state})`);
        }
    } catch (err) {
        logger.warn(`Could not cancel dispatch timeout job ${jobId}: ${err.message}`);
    }
}

/**
 * Schedule (or replace) a dispatch timeout check for an order.
 * @param {string} orderMongoId
 * @param {object} data - Job payload (must include attempt)
 * @param {number} [delay=20000]
 */
export async function scheduleDispatchTimeoutJob(orderMongoId, data, delay = 20000) {
    const jobId = dispatchTimeoutJobId(orderMongoId);
    const queue = getOrderQueue();

    if (!queue) {
        logger.warn('BullMQ order queue not available. Using setTimeout fallback for dispatch timeout.');

        const existing = pendingFallbackTimers.get(jobId);
        if (existing) clearTimeout(existing);

        const timerId = setTimeout(async () => {
            pendingFallbackTimers.delete(jobId);
            try {
                const { processOrderJob } = await import('../processors/order.processor.js');
                await processOrderJob({ id: jobId, data });
            } catch (err) {
                logger.error(`Fallback dispatch timeout job failed: ${err.message}`);
            }
        }, delay);

        pendingFallbackTimers.set(jobId, timerId);
        return { id: jobId };
    }

    await cancelDispatchTimeoutJob(orderMongoId);

    try {
        const job = await queue.add('process-order', data, { jobId, delay });
        logger.info(`Dispatch timeout job scheduled: ${job.id} attempt=${data.attempt} delay=${delay}ms`);
        return job;
    } catch (err) {
        logger.error(`Failed to schedule dispatch timeout job: ${err.message}`);
        throw err;
    }
}

/**
 * Add an order processing job to the queue. No-op if BullMQ is disabled.
 * @param {object} data - Job data (e.g. { orderId, action })
 * @param {object} [options] - BullMQ job options override
 * @returns {Promise<import('bullmq').Job | null>}
 */
export const addOrderJob = async (data, options = {}) => {
    const action = data?.action || '';

    // Route dispatch timeout jobs through the deduplicating scheduler.
    if (action === 'DISPATCH_TIMEOUT_CHECK' && data.orderMongoId) {
        return scheduleDispatchTimeoutJob(
            data.orderMongoId,
            data,
            options.delay ?? 20000,
        );
    }

    const queue = getOrderQueue();
    if (!queue) {
        logger.warn('BullMQ order queue not available. Using setTimeout fallback for job.');

        setTimeout(async () => {
            try {
                const { processOrderJob } = await import('../processors/order.processor.js');
                await processOrderJob({ id: `fallback-${Date.now()}`, data });
            } catch (err) {
                logger.error(`Fallback order job failed: ${err.message}`);
            }
        }, options.delay || 0);

        return { id: `fallback-${Date.now()}` };
    }
    try {
        const job = await queue.add('process-order', data, options);
        logger.info(`Order job added: ${job.id}`);
        return job;
    } catch (err) {
        logger.error(`Failed to add order job: ${err.message}`);
        throw err;
    }
};
