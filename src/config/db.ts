import logger from "../utils/logger";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        logger.info('MongoDB connected');
    } catch (error) {
        logger.error({ err: (error as any)?.message || error }, 'MongoDB connection failed');
        process.exit(1);
    }
};