import { environment } from '../auth/environment';

export const quoteDatabaseConfig = {
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  database: environment.DB_NAME,
  username: environment.DB_USER,
  password: environment.DB_PASSWORD,
  ssl: environment.DB_SSL,
  connectionTimeoutMillis: environment.DB_CONNECTION_TIMEOUT,
  idleTimeoutMillis: environment.DB_IDLE_TIMEOUT,
  max: environment.DB_MAX_CONNECTIONS
};

export const quoteQueryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  queryTimeout: 30000,
  transactionTimeout: 60000,
  lockTimeout: 10000
};

export const quoteTableNames = {
  QUOTES: 'quotes',
  QUOTE_ITEMS: 'quote_items',
  USERS: 'users',
  CLIENTS: 'clients',
  JOBS: 'jobs'
};

export const paymentTableNames = {
  QUOTE_PAYMENTS: 'quote_payments',
  USER_PAYMENT_METHODS: 'user_payment_methods',
  PAYMENT_WEBHOOKS: 'payment_webhooks'
};

export const quoteIndexNames = {
  QUOTES_TRADIE_ID: 'idx_quotes_tradie_id',
  QUOTES_CLIENT_ID: 'idx_quotes_client_id',
  QUOTES_JOB_ID: 'idx_quotes_job_id',
  QUOTES_STATUS: 'idx_quotes_status',
  QUOTES_QUOTE_NUMBER: 'idx_quotes_quote_number',
  QUOTES_VALID_UNTIL: 'idx_quotes_valid_until',
  QUOTES_CREATED_AT: 'idx_quotes_created_at',
  QUOTE_ITEMS_QUOTE_ID: 'idx_quote_items_quote_id',
  QUOTE_ITEMS_SORT_ORDER: 'idx_quote_items_sort_order'
};

export const paymentIndexNames = {
  QUOTE_PAYMENTS_QUOTE_ID: 'idx_quote_payments_quote_id',
  QUOTE_PAYMENTS_PAYMENT_INTENT_ID: 'idx_quote_payments_payment_intent_id',
  QUOTE_PAYMENTS_STATUS: 'idx_quote_payments_status',
  USER_PAYMENT_METHODS_USER_ID: 'idx_user_payment_methods_user_id',
  PAYMENT_WEBHOOKS_STRIPE_EVENT_ID: 'idx_payment_webhooks_stripe_event_id',
  PAYMENT_WEBHOOKS_PROCESSED: 'idx_payment_webhooks_processed'
};

export const quoteColumnNames = {
  QUOTES: {
    ID: 'id',
    TRADIE_ID: 'tradie_id',
    CLIENT_ID: 'client_id',
    JOB_ID: 'job_id',
    QUOTE_NUMBER: 'quote_number',
    TITLE: 'title',
    DESCRIPTION: 'description',
    STATUS: 'status',
    SUBTOTAL: 'subtotal',
    GST_AMOUNT: 'gst_amount',
    TOTAL_AMOUNT: 'total_amount',
    GST_ENABLED: 'gst_enabled',
    VALID_UNTIL: 'valid_until',
    TERMS_CONDITIONS: 'terms_conditions',
    NOTES: 'notes',
    SENT_AT: 'sent_at',
    VIEWED_AT: 'viewed_at',
    ACCEPTED_AT: 'accepted_at',
    REJECTED_AT: 'rejected_at',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at'
  },
  QUOTE_ITEMS: {
    ID: 'id',
    QUOTE_ID: 'quote_id',
    ITEM_TYPE: 'item_type',
    DESCRIPTION: 'description',
    QUANTITY: 'quantity',
    UNIT: 'unit',
    UNIT_PRICE: 'unit_price',
    TOTAL_PRICE: 'total_price',
    SORT_ORDER: 'sort_order',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at'
  }
};

export const paymentColumnNames = {
  QUOTE_PAYMENTS: {
    ID: 'id',
    QUOTE_ID: 'quote_id',
    PAYMENT_INTENT_ID: 'payment_intent_id',
    PAYMENT_ID: 'payment_id',
    AMOUNT: 'amount',
    CURRENCY: 'currency',
    STATUS: 'status',
    PAYMENT_METHOD_TYPE: 'payment_method_type',
    STRIPE_CUSTOMER_ID: 'stripe_customer_id',
    REFUND_ID: 'refund_id',
    REFUND_STATUS: 'refund_status',
    INVOICE_ID: 'invoice_id',
    INVOICE_NUMBER: 'invoice_number',
    FAILURE_REASON: 'failure_reason',
    PAID_AT: 'paid_at',
    REFUNDED_AT: 'refunded_at',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at'
  },
  USER_PAYMENT_METHODS: {
    ID: 'id',
    USER_ID: 'user_id',
    PAYMENT_METHOD_ID: 'payment_method_id',
    TYPE: 'type',
    CARD_BRAND: 'card_brand',
    CARD_LAST4: 'card_last4',
    CARD_EXPIRY_MONTH: 'card_expiry_month',
    CARD_EXPIRY_YEAR: 'card_expiry_year',
    IS_DEFAULT: 'is_default',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at'
  },
  PAYMENT_WEBHOOKS: {
    ID: 'id',
    STRIPE_EVENT_ID: 'stripe_event_id',
    EVENT_TYPE: 'event_type',
    PROCESSED: 'processed',
    PAYLOAD: 'payload',
    CREATED_AT: 'created_at',
    PROCESSED_AT: 'processed_at'
  }
};

export const quoteQueries = {
  CREATE_QUOTE: `
    INSERT INTO quotes (
      tradie_id, client_id, job_id, quote_number, title, description, status,
      subtotal, gst_amount, total_amount, gst_enabled, valid_until,
      terms_conditions, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *
  `,
  
  CREATE_QUOTE_ITEM: `
    INSERT INTO quote_items (
      quote_id, item_type, description, quantity, unit, unit_price,
      total_price, sort_order, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING *
  `,
  
  GET_QUOTE_BY_ID: `
    SELECT q.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
           u.username as tradie_username, u.email as tradie_email
    FROM quotes q
    LEFT JOIN clients c ON q.client_id = c.id
    LEFT JOIN users u ON q.tradie_id = u.id
    WHERE q.id = $1
  `,
  
  GET_QUOTE_BY_NUMBER: `
    SELECT q.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
           u.username as tradie_username, u.email as tradie_email
    FROM quotes q
    LEFT JOIN clients c ON q.client_id = c.id
    LEFT JOIN users u ON q.tradie_id = u.id
    WHERE q.quote_number = $1
  `,
  
  GET_QUOTE_ITEMS: `
    SELECT * FROM quote_items
    WHERE quote_id = $1
    ORDER BY sort_order ASC, created_at ASC
  `,
  
  GET_QUOTES_BY_TRADIE: `
    SELECT q.*, c.name as client_name, c.email as client_email
    FROM quotes q
    LEFT JOIN clients c ON q.client_id = c.id
    WHERE q.tradie_id = $1
    ORDER BY q.created_at DESC
    LIMIT $2 OFFSET $3
  `,
  
  GET_QUOTES_BY_CLIENT: `
    SELECT q.*, u.username as tradie_username, u.email as tradie_email
    FROM quotes q
    LEFT JOIN users u ON q.tradie_id = u.id
    WHERE q.client_id = $1
    ORDER BY q.created_at DESC
    LIMIT $2 OFFSET $3
  `,
  
  UPDATE_QUOTE: `
    UPDATE quotes SET
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      status = COALESCE($4, status),
      subtotal = COALESCE($5, subtotal),
      gst_amount = COALESCE($6, gst_amount),
      total_amount = COALESCE($7, total_amount),
      gst_enabled = COALESCE($8, gst_enabled),
      valid_until = COALESCE($9, valid_until),
      terms_conditions = COALESCE($10, terms_conditions),
      notes = COALESCE($11, notes),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
  
  UPDATE_QUOTE_STATUS: `
    UPDATE quotes SET
      status = $2,
      sent_at = CASE WHEN $2 = 'sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END,
      viewed_at = CASE WHEN $2 = 'viewed' AND viewed_at IS NULL THEN NOW() ELSE viewed_at END,
      accepted_at = CASE WHEN $2 = 'accepted' AND accepted_at IS NULL THEN NOW() ELSE accepted_at END,
      rejected_at = CASE WHEN $2 = 'rejected' AND rejected_at IS NULL THEN NOW() ELSE rejected_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
  
  DELETE_QUOTE: `
    DELETE FROM quotes WHERE id = $1 AND tradie_id = $2
  `,
  
  DELETE_QUOTE_ITEMS: `
    DELETE FROM quote_items WHERE quote_id = $1
  `,
  
  COUNT_QUOTES_BY_TRADIE: `
    SELECT COUNT(*) as total FROM quotes WHERE tradie_id = $1
  `,
  
  COUNT_QUOTES_BY_STATUS: `
    SELECT status, COUNT(*) as count
    FROM quotes
    WHERE tradie_id = $1
    GROUP BY status
  `
};

  GET_EXPIRING_QUOTES: `
    SELECT q.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
           u.username as tradie_username, u.email as tradie_email
    FROM quotes q
    LEFT JOIN clients c ON q.client_id = c.id
    LEFT JOIN users u ON q.tradie_id = u.id
    WHERE q.status IN ('sent', 'viewed')
    AND q.valid_until <= $1
    AND q.valid_until > NOW()
  `,
  
  GET_EXPIRED_QUOTES: `
    SELECT id FROM quotes
    WHERE status IN ('sent', 'viewed')
    AND valid_until <= NOW()
  `,
  
  EXPIRE_QUOTES: `
    UPDATE quotes SET
      status = 'expired',
      updated_at = NOW()
    WHERE status IN ('sent', 'viewed')
    AND valid_until <= NOW()
    RETURNING id, quote_number, tradie_id, client_id
  `,
  
  SEARCH_QUOTES: `
    SELECT q.*, c.name as client_name, c.email as client_email
    FROM quotes q
    LEFT JOIN clients c ON q.client_id = c.id
    WHERE q.tradie_id = $1
    AND ($2::text IS NULL OR q.status = $2)
    AND ($3::int IS NULL OR q.client_id = $3)
    AND ($4::int IS NULL OR q.job_id = $4)
    AND ($5::timestamp IS NULL OR q.created_at >= $5)
    AND ($6::timestamp IS NULL OR q.created_at <= $6)
    AND ($7::text IS NULL OR q.title ILIKE '%' || $7 || '%' OR q.description ILIKE '%' || $7 || '%')
    ORDER BY
      CASE WHEN $8 = 'created_at' AND $9 = 'desc' THEN q.created_at END DESC,
      CASE WHEN $8 = 'created_at' AND $9 = 'asc' THEN q.created_at END ASC,
      CASE WHEN $8 = 'total_amount' AND $9 = 'desc' THEN q.total_amount END DESC,
      CASE WHEN $8 = 'total_amount' AND $9 = 'asc' THEN q.total_amount END ASC,
      CASE WHEN $8 = 'valid_until' AND $9 = 'desc' THEN q.valid_until END DESC,
      CASE WHEN $8 = 'valid_until' AND $9 = 'asc' THEN q.valid_until END ASC,
      q.created_at DESC
    LIMIT $10 OFFSET $11
  `
};

export const paymentQueries = {
  CREATE_PAYMENT_INTENT: `
    INSERT INTO quote_payments (
      quote_id, payment_intent_id, amount, currency, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
    RETURNING *
  `,
  
  UPDATE_PAYMENT_STATUS: `
    UPDATE quote_payments SET
      status = $2,
      payment_id = COALESCE($3, payment_id),
      payment_method_type = COALESCE($4, payment_method_type),
      failure_reason = COALESCE($5, failure_reason),
      paid_at = CASE WHEN $2 = 'succeeded' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
      updated_at = NOW()
    WHERE quote_id = $1
    RETURNING *
  `,
  
  UPDATE_REFUND_STATUS: `
    UPDATE quote_payments SET
      refund_id = $2,
      refund_status = $3,
      refunded_at = CASE WHEN $3 = 'succeeded' AND refunded_at IS NULL THEN NOW() ELSE refunded_at END,
      updated_at = NOW()
    WHERE quote_id = $1
    RETURNING *
  `,
  
  SAVE_INVOICE_RECORD: `
    UPDATE quote_payments SET
      invoice_id = $2,
      invoice_number = $3,
      updated_at = NOW()
    WHERE quote_id = $1
    RETURNING *
  `,
  
  GET_PAYMENT_BY_QUOTE_ID: `
    SELECT * FROM quote_payments WHERE quote_id = $1
  `,
  
  GET_PAYMENT_BY_INTENT_ID: `
    SELECT * FROM quote_payments WHERE payment_intent_id = $1
  `,
  
  GET_PAYMENT_HISTORY_BY_USER: `
    SELECT p.*, q.quote_number, q.title as quote_title
    FROM quote_payments p
    JOIN quotes q ON p.quote_id = q.id
    WHERE (q.tradie_id = $1 AND $2 = 'tradie') OR (q.client_id = $1 AND $2 = 'client')
    ORDER BY p.created_at DESC
    LIMIT $3 OFFSET $4
  `,
  
  GET_PAYMENT_ANALYTICS: `
    SELECT 
      COUNT(*) as total_payments,
      SUM(amount) as total_amount,
      COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
      COUNT(CASE WHEN refund_status = 'succeeded' THEN 1 END) as refunded_payments,
      AVG(amount) as average_payment_amount,
      payment_method_type,
      COUNT(*) as method_count
    FROM quote_payments p
    JOIN quotes q ON p.quote_id = q.id
    WHERE q.tradie_id = $1 AND p.created_at BETWEEN $2 AND $3
    GROUP BY payment_method_type
  `,
  
  GET_MONTHLY_PAYMENT_TRENDS: `
    SELECT 
      DATE_TRUNC('month', p.created_at) as month,
      COUNT(*) as payments_count,
      SUM(amount) as total_amount,
      (COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / COUNT(*)) as success_rate
    FROM quote_payments p
    JOIN quotes q ON p.quote_id = q.id
    WHERE q.tradie_id = $1 AND p.created_at BETWEEN $2 AND $3
    GROUP BY DATE_TRUNC('month', p.created_at)
    ORDER BY month
  `,
  
  SAVE_PAYMENT_METHOD: `
    INSERT INTO user_payment_methods (
      user_id, payment_method_id, type, card_brand, card_last4,
      card_expiry_month, card_expiry_year, is_default, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    ON CONFLICT (user_id, payment_method_id) DO UPDATE SET
      type = EXCLUDED.type,
      card_brand = EXCLUDED.card_brand,
      card_last4 = EXCLUDED.card_last4,
      card_expiry_month = EXCLUDED.card_expiry_month,
      card_expiry_year = EXCLUDED.card_expiry_year,
      is_default = EXCLUDED.is_default,
      updated_at = NOW()
    RETURNING *
  `,
  
  GET_USER_PAYMENT_METHODS: `
    SELECT * FROM user_payment_methods
    WHERE user_id = $1
    ORDER BY is_default DESC, created_at DESC
  `,
  
  DELETE_PAYMENT_METHOD: `
    DELETE FROM user_payment_methods
    WHERE user_id = $1 AND payment_method_id = $2
    RETURNING *
  `,
  
  SET_DEFAULT_PAYMENT_METHOD: `
    UPDATE user_payment_methods SET
      is_default = CASE WHEN payment_method_id = $2 THEN TRUE ELSE FALSE END,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
  `,
  
  SAVE_WEBHOOK_EVENT: `
    INSERT INTO payment_webhooks (
      stripe_event_id, event_type, payload, created_at
    ) VALUES ($1, $2, $3, NOW())
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING *
  `,
  
  MARK_WEBHOOK_PROCESSED: `
    UPDATE payment_webhooks SET
      processed = TRUE,
      processed_at = NOW()
    WHERE stripe_event_id = $1
    RETURNING *
  `,
  
  GET_UNPROCESSED_WEBHOOKS: `
    SELECT * FROM payment_webhooks
    WHERE processed = FALSE
    ORDER BY created_at ASC
    LIMIT $1
  `,
  
  CLEANUP_OLD_WEBHOOKS: `
    DELETE FROM payment_webhooks
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND processed = TRUE
    RETURNING COUNT(*)
  `
};

export const quoteCacheConfig = {
  QUOTE_TTL: 300,
  QUOTE_LIST_TTL: 60,
  AI_PRICING_TTL: 3600,
  QUOTE_STATS_TTL: 300,
  EXPIRY_CHECK_TTL: 1800
};

export const paymentCacheConfig = {
  PAYMENT_INTENT_TTL: 1800,
  PAYMENT_METHOD_TTL: 3600,
  PAYMENT_ANALYTICS_TTL: 300,
  WEBHOOK_CACHE_TTL: 86400,
  PAYMENT_HISTORY_TTL: 600
};

export const quoteConnectionPool = {
  min: 2,
  max: 10,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200
};

export const paymentConnectionPool = {
  min: 1,
  max: 5,
  acquireTimeoutMillis: 15000,
  createTimeoutMillis: 15000,
  destroyTimeoutMillis: 3000,
  idleTimeoutMillis: 15000,
  reapIntervalMillis: 500,
  createRetryIntervalMillis: 100
};
