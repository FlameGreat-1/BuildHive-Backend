import { environment } from '../../shared/database/connection';

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
    PAYMENT_STATUS: 'payment_status',
    PAYMENT_ID: 'payment_id',
    INVOICE_ID: 'invoice_id',
    PAID_AT: 'paid_at',
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

  UPDATE_PAYMENT_STATUS: `
    UPDATE quotes SET
      payment_status = $2,
      payment_id = COALESCE($3, payment_id),
      paid_at = CASE WHEN $2 = 'succeeded' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
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
  `,

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
    AND ($8::text IS NULL OR q.payment_status = $8)
    ORDER BY
      CASE WHEN $9 = 'created_at' AND $10 = 'desc' THEN q.created_at END DESC,
      CASE WHEN $9 = 'created_at' AND $10 = 'asc' THEN q.created_at END ASC,
      CASE WHEN $9 = 'total_amount' AND $10 = 'desc' THEN q.total_amount END DESC,
      CASE WHEN $9 = 'total_amount' AND $10 = 'asc' THEN q.total_amount END ASC,
      CASE WHEN $9 = 'valid_until' AND $10 = 'desc' THEN q.valid_until END DESC,
      CASE WHEN $9 = 'valid_until' AND $10 = 'asc' THEN q.valid_until END ASC,
      q.created_at DESC
    LIMIT $11 OFFSET $12
  `,

  GET_QUOTE_ANALYTICS: `
    SELECT 
      COUNT(*) as total_quotes,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotes,
      COUNT(CASE WHEN payment_status = 'succeeded' THEN 1 END) as paid_quotes,
      SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN payment_status = 'succeeded' THEN total_amount ELSE 0 END) as paid_revenue,
      AVG(total_amount) as average_quote_value,
      AVG(EXTRACT(EPOCH FROM (accepted_at - created_at))/3600) as avg_response_time_hours
    FROM quotes
    WHERE tradie_id = $1 AND created_at BETWEEN $2 AND $3
  `,

  GET_MONTHLY_QUOTE_TRENDS: `
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as quotes_created,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as quotes_accepted,
      SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END) as total_value
    FROM quotes
    WHERE tradie_id = $1 AND created_at BETWEEN $2 AND $3
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
  `
};

export const quoteCacheConfig = {
  QUOTE_TTL: 300,
  QUOTE_LIST_TTL: 60,
  AI_PRICING_TTL: 3600,
  QUOTE_STATS_TTL: 300,
  EXPIRY_CHECK_TTL: 1800
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
