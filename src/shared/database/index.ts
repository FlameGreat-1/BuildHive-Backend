// Shared Database Module Export
// Centralized export for all database-related functionality

// Database connection
export {
  databaseConnection,
  connectDatabase,
  disconnectDatabase,
  getDatabaseHealth,
  getDatabaseStatus,
  getMongoConnection,
  getRedisClient,
  startTransaction,
  commitTransaction,
  abortTransaction,
} from './connection';

// Default export for convenience
export { default as connection } from './connection';

// Database utilities and services
export const database = {
  connection: databaseConnection,
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  health: getDatabaseHealth,
  status: getDatabaseStatus,
  mongo: getMongoConnection,
  redis: getRedisClient,
  transaction: {
    start: startTransaction,
    commit: commitTransaction,
    abort: abortTransaction,
  },
};

// Re-export types for convenience
export type {
  DatabaseConnectionStatus,
  DatabaseHealthMetrics,
} from '../types/database.types';

export default database;
