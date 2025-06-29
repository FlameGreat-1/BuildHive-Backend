import { Schema, model } from 'mongoose';
import { USER_ROLES } from '../../config/auth';
import { buildHiveLogger } from '../../shared';
import type { BaseDocument, UserRole } from '../../shared/types';

// Platform types for session tracking
export type SessionPlatform = 'web' | 'mobile';
export type SessionStatus = 'active' | 'expired' | 'revoked' | 'invalid';

// Device information interface
export interface DeviceInfo {
  userAgent: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isMobile: boolean;
}

// Location information interface
export interface LocationInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Session document interface extending BaseDocument
export interface ISessionDocument extends BaseDocument {
  // Core Session Information
  userId: Schema.Types.ObjectId;
  userRole: UserRole;
  username: string;
  email?: string;
  
  // Token Management
  refreshToken: string;
  refreshTokenHash: string;
  accessTokenJti?: string; // JWT ID for access token tracking
  
  // Session Metadata
  sessionId: string;
  platform: SessionPlatform;
  status: SessionStatus;
  
  // Device & Browser Information
  deviceInfo: DeviceInfo;
  deviceId: string;
  deviceFingerprint?: string;
  pushToken?: string; // For mobile push notifications
  
  // Location & Security
  locationInfo: LocationInfo;
  ipAddress: string;
  userAgent: string;
  
  // Session Timing
  loginTime: Date;
  lastActivity: Date;
  expiresAt: Date;
  logoutTime?: Date;
  
  // Security Features
  isSecure: boolean;
  isTrusted: boolean;
  requiresReauth: boolean;
  suspiciousActivity: boolean;
  
  // Session Activity Tracking
  activityLog: Array<{
    action: 'login' | 'refresh' | 'logout' | 'api_call' | 'suspicious';
    timestamp: Date;
    ip: string;
    userAgent?: string;
    endpoint?: string;
    details?: string;
  }>;
  
  // Multi-factor Authentication
  mfaVerified: boolean;
  mfaMethod?: 'sms' | 'email' | 'totp' | 'biometric';
  mfaVerifiedAt?: Date;
  
  // Enterprise Features
  enterpriseContext?: {
    teamId?: Schema.Types.ObjectId;
    permissions?: string[];
    delegatedBy?: Schema.Types.ObjectId;
    accessLevel: 'owner' | 'admin' | 'member' | 'viewer';
  };
  
  // Session Limits & Controls
  concurrentSessions: number;
  maxConcurrentSessions: number;
  
  // Audit Trail
  createdBy?: Schema.Types.ObjectId;
  revokedBy?: Schema.Types.ObjectId;
  revokedReason?: string;
  
  // Instance Methods
  isValid(): boolean;
  isExpired(): boolean;
  canRefresh(): boolean;
  updateActivity(action: string, details?: any): Promise<void>;
  revoke(reason?: string, revokedBy?: Schema.Types.ObjectId): Promise<void>;
  refresh(): Promise<string>;
  addSuspiciousActivity(details: string): Promise<void>;
  validateDevice(deviceInfo: DeviceInfo): boolean;
  updateLocation(locationInfo: LocationInfo): Promise<void>;
  extendSession(minutes: number): Promise<void>;
}

// Session Schema Definition
const sessionSchema = new Schema<ISessionDocument>({
  // Core Session Information
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  
  userRole: {
    type: String,
    enum: {
      values: Object.values(USER_ROLES),
      message: 'User role must be one of: {VALUES}'
    },
    required: [true, 'User role is required'],
    index: true,
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    index: true,
  },
  
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address'
    ],
  },
  
  // Token Management
  refreshToken: {
    type: String,
    required: [true, 'Refresh token is required'],
    unique: true,
    select: false, // Don't include in queries by default
  },
  
  refreshTokenHash: {
    type: String,
    required: [true, 'Refresh token hash is required'],
    unique: true,
    index: true,
    select: false,
  },
  
  accessTokenJti: {
    type: String,
    index: true,
    select: false,
  },
  
  // Session Metadata
  sessionId: {
    type: String,
    required: [true, 'Session ID is required'],
    unique: true,
    index: true,
  },
  
  platform: {
    type: String,
    enum: {
      values: ['web', 'mobile'],
      message: 'Platform must be either web or mobile'
    },
    required: [true, 'Platform is required'],
    index: true,
  },
  
  status: {
    type: String,
    enum: {
      values: ['active', 'expired', 'revoked', 'invalid'],
      message: 'Status must be one of: {VALUES}'
    },
    default: 'active',
    index: true,
  },
  
  // Device & Browser Information
  deviceInfo: {
    userAgent: {
      type: String,
      required: [true, 'User agent is required'],
      trim: true,
    },
    browser: {
      type: String,
      trim: true,
    },
    browserVersion: {
      type: String,
      trim: true,
    },
    os: {
      type: String,
      trim: true,
    },
    osVersion: {
      type: String,
      trim: true,
    },
    device: {
      type: String,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
  },
  
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    trim: true,
    index: true,
  },
  
  deviceFingerprint: {
    type: String,
    trim: true,
    index: true,
  },
  
  pushToken: {
    type: String,
    trim: true,
    sparse: true, // For mobile push notifications
  },
  
  // Location & Security
  locationInfo: {
    ip: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      trim: true,
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
  },
  
  ipAddress: {
    type: String,
    required: [true, 'IP address is required'],
    trim: true,
    index: true,
  },
  
  userAgent: {
    type: String,
    required: [true, 'User agent is required'],
    trim: true,
  },

  // Session Timing
  loginTime: {
    type: Date,
    required: [true, 'Login time is required'],
    default: Date.now,
    index: true,
  },
  
  lastActivity: {
    type: Date,
    required: [true, 'Last activity time is required'],
    default: Date.now,
    index: true,
  },
  
  expiresAt: {
    type: Date,
    required: [true, 'Expiration time is required'],
    index: true,
  },
  
  logoutTime: {
    type: Date,
    index: true,
  },
  
  // Security Features
  isSecure: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  isTrusted: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  requiresReauth: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  suspiciousActivity: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // Session Activity Tracking
  activityLog: [{
    action: {
      type: String,
      enum: ['login', 'refresh', 'logout', 'api_call', 'suspicious'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    ip: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    endpoint: {
      type: String,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
    },
  }],
  
  // Multi-factor Authentication
  mfaVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  mfaMethod: {
    type: String,
    enum: ['sms', 'email', 'totp', 'biometric'],
  },
  
  mfaVerifiedAt: {
    type: Date,
  },
  
  // Enterprise Features
  enterpriseContext: {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
    permissions: [{
      type: String,
      enum: [
        'manage_team',
        'assign_jobs',
        'view_analytics',
        'manage_billing',
        'manage_settings',
        'view_reports',
        'manage_users',
        'approve_jobs',
      ],
    }],
    delegatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    accessLevel: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member',
    },
  },
  
  // Session Limits & Controls
  concurrentSessions: {
    type: Number,
    default: 1,
    min: [1, 'Concurrent sessions must be at least 1'],
  },
  
  maxConcurrentSessions: {
    type: Number,
    default: 5,
    min: [1, 'Max concurrent sessions must be at least 1'],
    max: [10, 'Max concurrent sessions cannot exceed 10'],
  },
  
  // Audit Trail
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  
  revokedReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Revoked reason cannot exceed 500 characters'],
  },
}, {
  timestamps: true,
  versionKey: false,
  collection: 'sessions',
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.refreshToken;
      delete ret.refreshTokenHash;
      delete ret.accessTokenJti;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound Indexes for performance optimization
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ userId: 1, platform: 1 });
sessionSchema.index({ refreshTokenHash: 1, status: 1 });
sessionSchema.index({ sessionId: 1, status: 1 });
sessionSchema.index({ deviceId: 1, userId: 1 });
sessionSchema.index({ ipAddress: 1, userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
sessionSchema.index({ lastActivity: 1 });
sessionSchema.index({ loginTime: -1 });
sessionSchema.index({ status: 1, expiresAt: 1 });
sessionSchema.index({ suspiciousActivity: 1, status: 1 });

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
  if (this.logoutTime) {
    return this.logoutTime.getTime() - this.loginTime.getTime();
  }
  return Date.now() - this.loginTime.getTime();
});

// Virtual for time until expiration
sessionSchema.virtual('timeUntilExpiry').get(function() {
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

// Pre-save middleware for session validation
sessionSchema.pre('save', function(next) {
  // Ensure expiration time is in the future for new sessions
  if (this.isNew && this.expiresAt <= new Date()) {
    return next(new Error('Session expiration time must be in the future'));
  }
  
  // Update last activity on save
  if (!this.isNew) {
    this.lastActivity = new Date();
  }
  
  // Set secure flag based on platform and environment
  if (this.platform === 'web' && this.ipAddress && !this.ipAddress.startsWith('127.0.0.1')) {
    this.isSecure = true;
  }
  
  // Log session creation
  if (this.isNew) {
    buildHiveLogger.security.sessionCreated(this.username, {
      sessionId: this.sessionId,
      userId: this.userId,
      platform: this.platform,
      deviceType: this.deviceInfo.deviceType,
      ip: this.ipAddress,
      userAgent: this.userAgent,
    });
  }
  
  next();
});

// Pre-save middleware for activity logging
sessionSchema.pre('save', function(next) {
  // Add login activity for new sessions
  if (this.isNew) {
    this.activityLog.push({
      action: 'login',
      timestamp: new Date(),
      ip: this.ipAddress,
      userAgent: this.userAgent,
      details: `Login from ${this.platform} platform`,
    });
  }
  
  next();
});

// Instance Methods

// Check if session is valid
sessionSchema.methods.isValid = function(): boolean {
  return this.status === 'active' && 
         !this.isExpired() && 
         !this.suspiciousActivity;
};

// Check if session is expired
sessionSchema.methods.isExpired = function(): boolean {
  return this.expiresAt <= new Date();
};

// Check if session can be refreshed
sessionSchema.methods.canRefresh = function(): boolean {
  return this.status === 'active' && 
         !this.isExpired() && 
         !this.suspiciousActivity &&
         this.refreshToken;
};

// Update session activity
sessionSchema.methods.updateActivity = async function(action: string, details?: any): Promise<void> {
  this.lastActivity = new Date();
  
  this.activityLog.push({
    action: action as any,
    timestamp: new Date(),
    ip: details?.ip || this.ipAddress,
    userAgent: details?.userAgent || this.userAgent,
    endpoint: details?.endpoint,
    details: details?.description || `${action} activity`,
  });
  
  // Keep only last 50 activity logs for performance
  if (this.activityLog.length > 50) {
    this.activityLog = this.activityLog.slice(-50);
  }
  
  await this.save();
  
  buildHiveLogger.info('Session activity updated', {
    sessionId: this.sessionId,
    userId: this.userId,
    username: this.username,
    action,
    platform: this.platform,
  });
};

// Revoke session
sessionSchema.methods.revoke = async function(reason?: string, revokedBy?: Schema.Types.ObjectId): Promise<void> {
  this.status = 'revoked';
  this.logoutTime = new Date();
  this.revokedReason = reason;
  this.revokedBy = revokedBy;
  
  this.activityLog.push({
    action: 'logout',
    timestamp: new Date(),
    ip: this.ipAddress,
    details: reason || 'Session revoked',
  });
  
  await this.save();
  
  buildHiveLogger.security.sessionRevoked(this.username, {
    sessionId: this.sessionId,
    userId: this.userId,
    reason,
    revokedBy,
    platform: this.platform,
  });
};

// Refresh session token
sessionSchema.methods.refresh = async function(): Promise<string> {
  if (!this.canRefresh()) {
    throw new Error('Session cannot be refreshed');
  }
  
  // Generate new refresh token
  const crypto = require('crypto');
  const newRefreshToken = crypto.randomBytes(64).toString('hex');
  const newRefreshTokenHash = crypto
    .createHash('sha256')
    .update(newRefreshToken)
    .digest('hex');
  
  // Update session with new token
  this.refreshToken = newRefreshToken;
  this.refreshTokenHash = newRefreshTokenHash;
  this.lastActivity = new Date();
  
  // Extend expiration time (7 days for web, 30 days for mobile)
  const extensionTime = this.platform === 'mobile' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  this.expiresAt = new Date(Date.now() + extensionTime);
  
  // Log refresh activity
  this.activityLog.push({
    action: 'refresh',
    timestamp: new Date(),
    ip: this.ipAddress,
    details: 'Token refreshed',
  });
  
  await this.save();
  
  buildHiveLogger.info('Session token refreshed', {
    sessionId: this.sessionId,
    userId: this.userId,
    username: this.username,
    platform: this.platform,
    newExpiresAt: this.expiresAt,
  });
  
  return newRefreshToken;
};

// Add suspicious activity
sessionSchema.methods.addSuspiciousActivity = async function(details: string): Promise<void> {
  this.suspiciousActivity = true;
  this.requiresReauth = true;
  
  this.activityLog.push({
    action: 'suspicious',
    timestamp: new Date(),
    ip: this.ipAddress,
    userAgent: this.userAgent,
    details,
  });
  
  await this.save();
  
  buildHiveLogger.security.suspiciousActivity(this.username, {
    sessionId: this.sessionId,
    userId: this.userId,
    platform: this.platform,
    details,
    ip: this.ipAddress,
    userAgent: this.userAgent,
  });
};

// Validate device information
sessionSchema.methods.validateDevice = function(deviceInfo: DeviceInfo): boolean {
  // Check if device information matches stored device info
  const storedDevice = this.deviceInfo;
  
  // Basic validation - device type and mobile flag should match
  if (storedDevice.deviceType !== deviceInfo.deviceType ||
      storedDevice.isMobile !== deviceInfo.isMobile) {
    return false;
  }
  
  // For mobile devices, check OS consistency
  if (deviceInfo.isMobile && storedDevice.os && deviceInfo.os) {
    if (storedDevice.os !== deviceInfo.os) {
      return false;
    }
  }
  
  // For web browsers, check browser consistency
  if (!deviceInfo.isMobile && storedDevice.browser && deviceInfo.browser) {
    if (storedDevice.browser !== deviceInfo.browser) {
      return false;
    }
  }
  
  return true;
};

// Update location information
sessionSchema.methods.updateLocation = async function(locationInfo: LocationInfo): Promise<void> {
  // Check for significant location change
  const currentLocation = this.locationInfo;
  let locationChanged = false;
  
  if (currentLocation.country !== locationInfo.country ||
      currentLocation.region !== locationInfo.region) {
    locationChanged = true;
  }
  
  // Update location info
  this.locationInfo = locationInfo;
  this.ipAddress = locationInfo.ip;
  this.lastActivity = new Date();
  
  // Log location change if significant
  if (locationChanged) {
    this.activityLog.push({
      action: 'api_call',
      timestamp: new Date(),
      ip: locationInfo.ip,
      details: `Location changed from ${currentLocation.country}/${currentLocation.region} to ${locationInfo.country}/${locationInfo.region}`,
    });
    
    buildHiveLogger.security.locationChanged(this.username, {
      sessionId: this.sessionId,
      userId: this.userId,
      oldLocation: `${currentLocation.country}/${currentLocation.region}`,
      newLocation: `${locationInfo.country}/${locationInfo.region}`,
      oldIp: currentLocation.ip,
      newIp: locationInfo.ip,
    });
  }
  
  await this.save();
};

// Extend session duration
sessionSchema.methods.extendSession = async function(minutes: number): Promise<void> {
  if (this.status !== 'active') {
    throw new Error('Cannot extend inactive session');
  }
  
  const extensionTime = minutes * 60 * 1000;
  const newExpiresAt = new Date(this.expiresAt.getTime() + extensionTime);
  
  // Don't allow extension beyond maximum session duration
  const maxSessionDuration = this.platform === 'mobile' ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000; // 90 days mobile, 30 days web
  const maxExpiresAt = new Date(this.loginTime.getTime() + maxSessionDuration);
  
  this.expiresAt = newExpiresAt > maxExpiresAt ? maxExpiresAt : newExpiresAt;
  this.lastActivity = new Date();
  
  this.activityLog.push({
    action: 'api_call',
    timestamp: new Date(),
    ip: this.ipAddress,
    details: `Session extended by ${minutes} minutes`,
  });
  
  await this.save();
  
  buildHiveLogger.info('Session extended', {
    sessionId: this.sessionId,
    userId: this.userId,
    username: this.username,
    extensionMinutes: minutes,
    newExpiresAt: this.expiresAt,
  });
};

// Static Methods

// Find active sessions for user
sessionSchema.statics.findActiveSessions = function(userId: Schema.Types.ObjectId) {
  return this.find({
    userId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).sort({ lastActivity: -1 });
};

// Find sessions by device
sessionSchema.statics.findSessionsByDevice = function(deviceId: string) {
  return this.find({
    deviceId,
    status: 'active',
  }).sort({ lastActivity: -1 });
};

// Cleanup expired sessions
sessionSchema.statics.cleanupExpiredSessions = async function() {
  const result = await this.updateMany(
    {
      status: 'active',
      expiresAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'expired',
        logoutTime: new Date(),
      },
    }
  );
  
  buildHiveLogger.info('Expired sessions cleaned up', {
    modifiedCount: result.modifiedCount,
  });
  
  return result;
};

// Revoke all sessions for user
sessionSchema.statics.revokeAllUserSessions = async function(
  userId: Schema.Types.ObjectId, 
  reason: string = 'All sessions revoked',
  revokedBy?: Schema.Types.ObjectId
) {
  const result = await this.updateMany(
    {
      userId,
      status: 'active',
    },
    {
      $set: {
        status: 'revoked',
        logoutTime: new Date(),
        revokedReason: reason,
        revokedBy,
      },
      $push: {
        activityLog: {
          action: 'logout',
          timestamp: new Date(),
          ip: 'system',
          details: reason,
        },
      },
    }
  );
  
  buildHiveLogger.security.allSessionsRevoked(userId.toString(), {
    revokedCount: result.modifiedCount,
    reason,
    revokedBy,
  });
  
  return result;
};

// Find suspicious sessions
sessionSchema.statics.findSuspiciousSessions = function() {
  return this.find({
    suspiciousActivity: true,
    status: 'active',
  }).sort({ lastActivity: -1 });
};

// Get session statistics
sessionSchema.statics.getSessionStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const platformStats = await this.aggregate([
    {
      $match: { status: 'active' },
    },
    {
      $group: {
        _id: '$platform',
        count: { $sum: 1 },
      },
    },
  ]);
  
  return {
    statusBreakdown: stats,
    platformBreakdown: platformStats,
    totalActive: stats.find(s => s._id === 'active')?.count || 0,
  };
};

// Pre-remove middleware for cleanup
sessionSchema.pre('remove', function(next) {
  buildHiveLogger.info('Session removed', {
    sessionId: this.sessionId,
    userId: this.userId,
    username: this.username,
    platform: this.platform,
  });
  next();
});

// Create and export the Session model
export const Session = model<ISessionDocument>('Session', sessionSchema);

export default Session;
