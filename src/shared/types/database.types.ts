export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export interface DatabaseTransaction {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  transaction(): Promise<DatabaseTransaction>;
  end(): Promise<void>;
}

export enum UserRole {
  CLIENT = 'client',
  TRADIE = 'tradie',
  ENTERPRISE = 'enterprise'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended'
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook'
}
