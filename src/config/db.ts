import mongoose from 'mongoose';
import logger from "../utils/logger";

export const connectDB = async () => {
    try {
        logger.info('MongoDB connected');
    } catch (error) {
        logger.error({ err: (error as any)?.message || error }, 'MongoDB connection failed');
        process.exit(1);
    }
};