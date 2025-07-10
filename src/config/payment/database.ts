import { DatabaseClient } from '../../shared/types';

export const PAYMENT_TABLES = {
  PAYMENTS: 'payments',
  PAYMENT_METHODS: 'payment_methods',
  WEBHOOK_EVENTS: 'webhook_events'
};

export const createPaymentTables = async (client: DatabaseClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${PAYMENT_TABLES.PAYMENTS} (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_payment_intent_id VARCHAR(255),
      amount INTEGER NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
      payment_method VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      description TEXT,
      metadata JSONB DEFAULT '{}',
      processed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${PAYMENT_TABLES.PAYMENT_METHODS} (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
      type VARCHAR(50) NOT NULL,
      card_last_four VARCHAR(4),
      card_brand VARCHAR(20),
      card_exp_month INTEGER,
      card_exp_year INTEGER,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${PAYMENT_TABLES.WEBHOOK_EVENTS} (
      id SERIAL PRIMARY KEY,
      stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
      event_type VARCHAR(100) NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON ${PAYMENT_TABLES.PAYMENTS}(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON ${PAYMENT_TABLES.PAYMENTS}(stripe_payment_intent_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON ${PAYMENT_TABLES.PAYMENT_METHODS}(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON ${PAYMENT_TABLES.WEBHOOK_EVENTS}(processed)`);
};
