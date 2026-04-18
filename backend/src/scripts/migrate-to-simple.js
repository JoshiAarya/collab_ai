import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

import Decision from '../models/Decision.js';

async function migrate() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, config.mongodbOptions || {});
    logger.info('Connected to MongoDB. Starting migration to simple architecture...');

    // 1. Drop old collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    if (colNames.includes('topics')) {
      await mongoose.connection.db.dropCollection('topics');
      logger.info('Dropped topics collection');
    }
    if (colNames.includes('blockers')) {
      await mongoose.connection.db.dropCollection('blockers');
      logger.info('Dropped blockers collection');
    }
    if (colNames.includes('actionitems')) {
      await mongoose.connection.db.dropCollection('actionitems');
      logger.info('Dropped actionitems collection');
    }
    if (colNames.includes('projectinsights')) {
      await mongoose.connection.db.dropCollection('projectinsights');
      logger.info('Dropped projectinsights collection');
    }
    if (colNames.includes('pendingsignals')) {
      await mongoose.connection.db.dropCollection('pendingsignals');
      logger.info('Dropped pendingsignals collection');
    }
    if (colNames.includes('rooms')) {
      await mongoose.connection.db.dropCollection('rooms');
      logger.info('Dropped rooms collection');
    }
    if (colNames.includes('projectstates')) {
      await mongoose.connection.db.dropCollection('projectstates');
      logger.info('Dropped projectstates collection (legacy pinnedContext)');
    }

    // 2. Clear all existing decisions
    const delRes = await Decision.deleteMany({});
    logger.info(`Deleted ${delRes.deletedCount} legacy decisions.`);

    logger.info('Migration complete!');
    process.exit(0);

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
