export const MARKETPLACE_TABLES = {
    MARKETPLACE_JOBS: 'marketplace_jobs',
    JOB_APPLICATIONS: 'job_applications',
    MARKETPLACE_JOB_ASSIGNMENTS: 'marketplace_job_assignments',
    MARKETPLACE_NOTIFICATIONS: 'marketplace_notifications',
    MARKETPLACE_ANALYTICS: 'marketplace_analytics',
    TRADIE_MARKETPLACE_STATS: 'tradie_marketplace_stats',
    CLIENT_MARKETPLACE_STATS: 'client_marketplace_stats'
  } as const;
  
  export const MARKETPLACE_QUERIES = {
    CREATE_MARKETPLACE_JOB: `
      INSERT INTO marketplace_jobs (
        client_id, title, description, job_type, location, estimated_budget,
        date_required, urgency_level, photos, client_name, client_email,
        client_phone, client_company, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `,
  
    GET_MARKETPLACE_JOB_BY_ID: `
      SELECT mj.*, 
             COUNT(ja.id) as application_count,
             CASE WHEN mj.expires_at < NOW() THEN 'expired' ELSE mj.status END as current_status
      FROM marketplace_jobs mj
      LEFT JOIN job_applications ja ON mj.id = ja.marketplace_job_id
      WHERE mj.id = $1
      GROUP BY mj.id
    `,
  
    GET_MARKETPLACE_JOBS_LIST: `
      SELECT mj.id, mj.title, mj.job_type, mj.location, mj.estimated_budget,
             mj.date_required, mj.urgency_level, mj.status, mj.created_at,
             COUNT(ja.id) as application_count,
             CASE WHEN mj.expires_at < NOW() THEN 'expired' ELSE mj.status END as current_status
      FROM marketplace_jobs mj
      LEFT JOIN job_applications ja ON mj.id = ja.marketplace_job_id
      WHERE mj.status = 'available' AND mj.expires_at > NOW()
      GROUP BY mj.id
      ORDER BY mj.created_at DESC
      LIMIT $1 OFFSET $2
    `,
  
    SEARCH_MARKETPLACE_JOBS: `
      SELECT mj.id, mj.title, mj.job_type, mj.location, mj.estimated_budget,
             mj.date_required, mj.urgency_level, mj.status, mj.created_at,
             COUNT(ja.id) as application_count,
             CASE WHEN mj.expires_at < NOW() THEN 'expired' ELSE mj.status END as current_status
      FROM marketplace_jobs mj
      LEFT JOIN job_applications ja ON mj.id = ja.marketplace_job_id
      WHERE mj.status = 'available' 
        AND mj.expires_at > NOW()
        AND ($3::text IS NULL OR mj.title ILIKE '%' || $3 || '%' OR mj.description ILIKE '%' || $3 || '%')
        AND ($4::text IS NULL OR mj.job_type = $4)
        AND ($5::text IS NULL OR mj.location ILIKE '%' || $5 || '%')
        AND ($6::text IS NULL OR mj.urgency_level = $6)
        AND ($7::numeric IS NULL OR mj.estimated_budget >= $7)
        AND ($8::numeric IS NULL OR mj.estimated_budget <= $8)
      GROUP BY mj.id
      ORDER BY 
        CASE WHEN $9 = 'date_posted' THEN mj.created_at END DESC,
        CASE WHEN $9 = 'budget_desc' THEN mj.estimated_budget END DESC,
        CASE WHEN $9 = 'budget_asc' THEN mj.estimated_budget END ASC,
        CASE WHEN $9 = 'urgency' THEN 
          CASE mj.urgency_level 
            WHEN 'urgent' THEN 4 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            ELSE 1 
          END 
        END DESC,
        CASE WHEN $9 = 'application_count' THEN COUNT(ja.id) END DESC
      LIMIT $1 OFFSET $2
    `,
  
    UPDATE_MARKETPLACE_JOB_STATUS: `
      UPDATE marketplace_jobs 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
  
    UPDATE_MARKETPLACE_JOB_APPLICATION_COUNT: `
      UPDATE marketplace_jobs 
      SET application_count = application_count + 1, updated_at = NOW()
      WHERE id = $1
    `,
  
    CREATE_JOB_APPLICATION: `
      INSERT INTO job_applications (
        marketplace_job_id, tradie_id, custom_quote, proposed_timeline,
        approach_description, materials_list, availability_dates, cover_message,
        relevant_experience, additional_photos, questions_for_client, special_offers,
        credits_used, status, application_timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted', NOW(), NOW(), NOW())
      RETURNING *
    `,
  
    GET_APPLICATION_BY_ID: `
      SELECT ja.*, u.username, u.email, p.first_name, p.last_name, p.phone, p.avatar
      FROM job_applications ja
      JOIN users u ON ja.tradie_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE ja.id = $1
    `,
  
    GET_APPLICATIONS_BY_JOB: `
      SELECT ja.*, u.username, u.email, p.first_name, p.last_name, p.phone, p.avatar,
             tms.total_applications, tms.successful_applications, tms.conversion_rate
      FROM job_applications ja
      JOIN users u ON ja.tradie_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN tradie_marketplace_stats tms ON u.id = tms.tradie_id
      WHERE ja.marketplace_job_id = $1
      ORDER BY ja.application_timestamp DESC
    `,
  
    GET_APPLICATIONS_BY_TRADIE: `
      SELECT ja.*, mj.title, mj.job_type, mj.location, mj.estimated_budget, mj.status as job_status
      FROM job_applications ja
      JOIN marketplace_jobs mj ON ja.marketplace_job_id = mj.id
      WHERE ja.tradie_id = $1
      ORDER BY ja.application_timestamp DESC
      LIMIT $2 OFFSET $3
    `,
  
    CHECK_EXISTING_APPLICATION: `
      SELECT id FROM job_applications 
      WHERE marketplace_job_id = $1 AND tradie_id = $2
    `,
  
    UPDATE_APPLICATION_STATUS: `
      UPDATE job_applications 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `
  };

  CREATE_JOB_ASSIGNMENT: `
  INSERT INTO marketplace_job_assignments (
    marketplace_job_id, selected_tradie_id, selected_application_id,
    existing_job_id, selection_reason, negotiated_quote, project_start_date,
    assignment_timestamp, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
  RETURNING *
`,

GET_JOB_ASSIGNMENT: `
  SELECT mja.*, u.username, u.email, p.first_name, p.last_name, mj.title
  FROM marketplace_job_assignments mja
  JOIN users u ON mja.selected_tradie_id = u.id
  LEFT JOIN profiles p ON u.id = p.user_id
  JOIN marketplace_jobs mj ON mja.marketplace_job_id = mj.id
  WHERE mja.marketplace_job_id = $1
`,

CREATE_MARKETPLACE_NOTIFICATION: `
  INSERT INTO marketplace_notifications (
    user_id, notification_type, title, message, marketplace_job_id,
    application_id, assignment_id, expires_at, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
  RETURNING *
`,

GET_USER_NOTIFICATIONS: `
  SELECT * FROM marketplace_notifications
  WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT $2 OFFSET $3
`,

MARK_NOTIFICATION_READ: `
  UPDATE marketplace_notifications 
  SET read = true, read_at = NOW()
  WHERE id = $1 AND user_id = $2
`,

UPDATE_TRADIE_STATS: `
  INSERT INTO tradie_marketplace_stats (
    tradie_id, total_applications, successful_applications, total_credits_spent,
    conversion_rate, average_quote, last_application_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  ON CONFLICT (tradie_id) DO UPDATE SET
    total_applications = EXCLUDED.total_applications,
    successful_applications = EXCLUDED.successful_applications,
    total_credits_spent = EXCLUDED.total_credits_spent,
    conversion_rate = EXCLUDED.conversion_rate,
    average_quote = EXCLUDED.average_quote,
    last_application_at = EXCLUDED.last_application_at,
    updated_at = NOW()
`,

UPDATE_CLIENT_STATS: `
  INSERT INTO client_marketplace_stats (
    client_id, total_jobs_posted, total_applications_received, total_hires_made,
    average_applications_per_job, average_hire_time_hours, last_job_posted_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  ON CONFLICT (client_id) DO UPDATE SET
    total_jobs_posted = EXCLUDED.total_jobs_posted,
    total_applications_received = EXCLUDED.total_applications_received,
    total_hires_made = EXCLUDED.total_hires_made,
    average_applications_per_job = EXCLUDED.average_applications_per_job,
    average_hire_time_hours = EXCLUDED.average_hire_time_hours,
    last_job_posted_at = EXCLUDED.last_job_posted_at,
    updated_at = NOW()
`,

GET_TRADIE_STATS: `
  SELECT * FROM tradie_marketplace_stats WHERE tradie_id = $1
`,

GET_CLIENT_STATS: `
  SELECT * FROM client_marketplace_stats WHERE client_id = $1
`,

GET_MARKETPLACE_ANALYTICS: `
  SELECT * FROM marketplace_analytics 
  WHERE date >= $1 AND date <= $2
  ORDER BY date DESC
`,

UPDATE_MARKETPLACE_ANALYTICS: `
  INSERT INTO marketplace_analytics (
    date, total_jobs_posted, total_applications, total_credits_spent,
    total_assignments, average_applications_per_job, conversion_rate,
    top_job_types, top_locations, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
  ON CONFLICT (date) DO UPDATE SET
    total_jobs_posted = EXCLUDED.total_jobs_posted,
    total_applications = EXCLUDED.total_applications,
    total_credits_spent = EXCLUDED.total_credits_spent,
    total_assignments = EXCLUDED.total_assignments,
    average_applications_per_job = EXCLUDED.average_applications_per_job,
    conversion_rate = EXCLUDED.conversion_rate,
    top_job_types = EXCLUDED.top_job_types,
    top_locations = EXCLUDED.top_locations
`,

EXPIRE_OLD_JOBS: `
  UPDATE marketplace_jobs 
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW() AND status = 'available'
  RETURNING id, title
`,

GET_JOBS_BY_CLIENT: `
  SELECT mj.*, COUNT(ja.id) as application_count
  FROM marketplace_jobs mj
  LEFT JOIN job_applications ja ON mj.id = ja.marketplace_job_id
  WHERE mj.client_id = $1
  GROUP BY mj.id
  ORDER BY mj.created_at DESC
  LIMIT $2 OFFSET $3
`,

DELETE_MARKETPLACE_JOB: `
  UPDATE marketplace_jobs 
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = $1 AND client_id = $2
  RETURNING *
`
};

export const MARKETPLACE_INDEXES = {
MARKETPLACE_JOBS_CLIENT_ID: 'idx_marketplace_jobs_client_id',
MARKETPLACE_JOBS_STATUS: 'idx_marketplace_jobs_status',
MARKETPLACE_JOBS_JOB_TYPE: 'idx_marketplace_jobs_job_type',
MARKETPLACE_JOBS_LOCATION: 'idx_marketplace_jobs_location',
MARKETPLACE_JOBS_CREATED_AT: 'idx_marketplace_jobs_created_at',
MARKETPLACE_JOBS_EXPIRES_AT: 'idx_marketplace_jobs_expires_at',
JOB_APPLICATIONS_MARKETPLACE_JOB_ID: 'idx_job_applications_marketplace_job_id',
JOB_APPLICATIONS_TRADIE_ID: 'idx_job_applications_tradie_id',
JOB_APPLICATIONS_STATUS: 'idx_job_applications_status',
JOB_APPLICATIONS_CREATED_AT: 'idx_job_applications_created_at',
MARKETPLACE_NOTIFICATIONS_USER_ID: 'idx_marketplace_notifications_user_id',
MARKETPLACE_NOTIFICATIONS_TYPE: 'idx_marketplace_notifications_notification_type',
MARKETPLACE_NOTIFICATIONS_READ: 'idx_marketplace_notifications_read'
} as const;

export const MARKETPLACE_CONSTRAINTS = {
UNIQUE_APPLICATION_PER_JOB: 'unique_application_per_job',
UNIQUE_ASSIGNMENT_PER_JOB: 'unique_assignment_per_job',
UNIQUE_TRADIE_STATS: 'unique_tradie_marketplace_stats',
UNIQUE_CLIENT_STATS: 'unique_client_marketplace_stats',
UNIQUE_ANALYTICS_DATE: 'unique_marketplace_analytics_date'
} as const;

export const MARKETPLACE_TRIGGERS = {
UPDATE_APPLICATION_COUNT: 'trigger_update_application_count',
UPDATE_TRADIE_STATS: 'trigger_update_tradie_stats',
UPDATE_CLIENT_STATS: 'trigger_update_client_stats',
EXPIRE_OLD_JOBS: 'trigger_expire_old_jobs'
} as const;

export const MARKETPLACE_VIEWS = {
ACTIVE_JOBS_WITH_STATS: 'view_active_marketplace_jobs_with_stats',
TRADIE_APPLICATION_SUMMARY: 'view_tradie_application_summary',
CLIENT_JOB_SUMMARY: 'view_client_job_summary'
} as const;

  