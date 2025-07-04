export const JOB_DATABASE_CONFIG = {
  TABLES: {
    JOBS: 'jobs',
    CLIENTS: 'clients',
    MATERIALS: 'materials',
    JOB_ATTACHMENTS: 'job_attachments'
  },
  
  INDEXES: {
    JOBS: {
      TRADIE_ID: 'idx_jobs_tradie_id',
      CLIENT_ID: 'idx_jobs_client_id',
      STATUS: 'idx_jobs_status',
      JOB_TYPE: 'idx_jobs_job_type',
      PRIORITY: 'idx_jobs_priority',
      START_DATE: 'idx_jobs_start_date',
      DUE_DATE: 'idx_jobs_due_date',
      CREATED_AT: 'idx_jobs_created_at',
      COMPOSITE_TRADIE_STATUS: 'idx_jobs_tradie_status',
      COMPOSITE_TRADIE_TYPE: 'idx_jobs_tradie_type'
    },
    CLIENTS: {
      TRADIE_ID: 'idx_clients_tradie_id',
      EMAIL: 'idx_clients_email',
      COMPOSITE_TRADIE_EMAIL: 'idx_clients_tradie_email'
    },
    MATERIALS: {
      JOB_ID: 'idx_materials_job_id'
    },
    JOB_ATTACHMENTS: {
      JOB_ID: 'idx_job_attachments_job_id'
    }
  },
  
  CONSTRAINTS: {
    JOBS: {
      UNIQUE_TRADIE_TITLE: 'unique_tradie_job_title',
      CHECK_DATE_RANGE: 'check_job_date_range',
      CHECK_HOURS_POSITIVE: 'check_hours_positive',
      CHECK_DURATION_POSITIVE: 'check_duration_positive'
    },
    CLIENTS: {
      UNIQUE_TRADIE_EMAIL: 'unique_tradie_client_email'
    },
    MATERIALS: {
      CHECK_QUANTITY_POSITIVE: 'check_material_quantity_positive',
      CHECK_COST_POSITIVE: 'check_material_cost_positive'
    },
    JOB_ATTACHMENTS: {
      CHECK_FILE_SIZE: 'check_file_size_positive'
    }
  },
  
  FOREIGN_KEYS: {
    JOBS_TRADIE_ID: 'fk_jobs_tradie_id',
    JOBS_CLIENT_ID: 'fk_jobs_client_id',
    CLIENTS_TRADIE_ID: 'fk_clients_tradie_id',
    MATERIALS_JOB_ID: 'fk_materials_job_id',
    JOB_ATTACHMENTS_JOB_ID: 'fk_job_attachments_job_id'
  },
  
  COLUMN_DEFINITIONS: {
    JOBS: {
      ID: 'id SERIAL PRIMARY KEY',
      TRADIE_ID: 'tradie_id INTEGER NOT NULL',
      CLIENT_ID: 'client_id INTEGER NOT NULL',
      TITLE: 'title VARCHAR(200) NOT NULL',
      DESCRIPTION: 'description TEXT NOT NULL',
      JOB_TYPE: 'job_type VARCHAR(50) NOT NULL',
      STATUS: 'status VARCHAR(20) NOT NULL DEFAULT \'pending\'',
      PRIORITY: 'priority VARCHAR(20) NOT NULL DEFAULT \'medium\'',
      CLIENT_NAME: 'client_name VARCHAR(100) NOT NULL',
      CLIENT_EMAIL: 'client_email VARCHAR(255) NOT NULL',
      CLIENT_PHONE: 'client_phone VARCHAR(20) NOT NULL',
      CLIENT_COMPANY: 'client_company VARCHAR(100)',
      SITE_ADDRESS: 'site_address TEXT NOT NULL',
      SITE_CITY: 'site_city VARCHAR(50) NOT NULL',
      SITE_STATE: 'site_state VARCHAR(50) NOT NULL',
      SITE_POSTCODE: 'site_postcode VARCHAR(10) NOT NULL',
      SITE_ACCESS_INSTRUCTIONS: 'site_access_instructions TEXT',
      START_DATE: 'start_date TIMESTAMP NOT NULL',
      DUE_DATE: 'due_date TIMESTAMP NOT NULL',
      ESTIMATED_DURATION: 'estimated_duration INTEGER NOT NULL',
      HOURS_WORKED: 'hours_worked DECIMAL(5,2) DEFAULT 0.00',
      NOTES: 'notes TEXT[] DEFAULT \'{}\'',
      TAGS: 'tags TEXT[] DEFAULT \'{}\'',
      CREATED_AT: 'created_at TIMESTAMP DEFAULT NOW()',
      UPDATED_AT: 'updated_at TIMESTAMP DEFAULT NOW()'
    },
    
    CLIENTS: {
      ID: 'id SERIAL PRIMARY KEY',
      TRADIE_ID: 'tradie_id INTEGER NOT NULL',
      NAME: 'name VARCHAR(100) NOT NULL',
      EMAIL: 'email VARCHAR(255) NOT NULL',
      PHONE: 'phone VARCHAR(20) NOT NULL',
      COMPANY: 'company VARCHAR(100)',
      ADDRESS: 'address TEXT',
      CITY: 'city VARCHAR(50)',
      STATE: 'state VARCHAR(50)',
      POSTCODE: 'postcode VARCHAR(10)',
      NOTES: 'notes TEXT',
      TAGS: 'tags TEXT[] DEFAULT \'{}\'',
      TOTAL_JOBS: 'total_jobs INTEGER DEFAULT 0',
      TOTAL_REVENUE: 'total_revenue DECIMAL(10,2) DEFAULT 0.00',
      LAST_JOB_DATE: 'last_job_date TIMESTAMP',
      CREATED_AT: 'created_at TIMESTAMP DEFAULT NOW()',
      UPDATED_AT: 'updated_at TIMESTAMP DEFAULT NOW()'
    },
    
    MATERIALS: {
      ID: 'id SERIAL PRIMARY KEY',
      JOB_ID: 'job_id INTEGER NOT NULL',
      NAME: 'name VARCHAR(200) NOT NULL',
      QUANTITY: 'quantity DECIMAL(10,2) NOT NULL',
      UNIT: 'unit VARCHAR(20) NOT NULL',
      UNIT_COST: 'unit_cost DECIMAL(10,2) NOT NULL',
      TOTAL_COST: 'total_cost DECIMAL(10,2) NOT NULL',
      SUPPLIER: 'supplier VARCHAR(100)',
      CREATED_AT: 'created_at TIMESTAMP DEFAULT NOW()',
      UPDATED_AT: 'updated_at TIMESTAMP DEFAULT NOW()'
    },
    
    JOB_ATTACHMENTS: {
      ID: 'id SERIAL PRIMARY KEY',
      JOB_ID: 'job_id INTEGER NOT NULL',
      FILENAME: 'filename VARCHAR(255) NOT NULL',
      ORIGINAL_NAME: 'original_name VARCHAR(255) NOT NULL',
      FILE_PATH: 'file_path TEXT NOT NULL',
      FILE_SIZE: 'file_size INTEGER NOT NULL',
      MIME_TYPE: 'mime_type VARCHAR(100) NOT NULL',
      UPLOADED_AT: 'uploaded_at TIMESTAMP DEFAULT NOW()'
    }
  },
  
  QUERIES: {
    CREATE_INDEXES: [
      'CREATE INDEX IF NOT EXISTS idx_jobs_tradie_id ON jobs(tradie_id);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON jobs(start_date);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON jobs(due_date);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_tradie_status ON jobs(tradie_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_tradie_type ON jobs(tradie_id, job_type);',
      'CREATE INDEX IF NOT EXISTS idx_clients_tradie_id ON clients(tradie_id);',
      'CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);',
      'CREATE INDEX IF NOT EXISTS idx_clients_tradie_email ON clients(tradie_id, email);',
      'CREATE INDEX IF NOT EXISTS idx_materials_job_id ON materials(job_id);',
      'CREATE INDEX IF NOT EXISTS idx_job_attachments_job_id ON job_attachments(job_id);'
    ],
    
    CREATE_CONSTRAINTS: [
      'ALTER TABLE jobs ADD CONSTRAINT check_job_date_range CHECK (due_date > start_date);',
      'ALTER TABLE jobs ADD CONSTRAINT check_hours_positive CHECK (hours_worked >= 0);',
      'ALTER TABLE jobs ADD CONSTRAINT check_duration_positive CHECK (estimated_duration > 0);',
      'ALTER TABLE materials ADD CONSTRAINT check_material_quantity_positive CHECK (quantity > 0);',
      'ALTER TABLE materials ADD CONSTRAINT check_material_cost_positive CHECK (unit_cost >= 0);',
      'ALTER TABLE job_attachments ADD CONSTRAINT check_file_size_positive CHECK (file_size > 0);'
    ]
  }
} as const;
