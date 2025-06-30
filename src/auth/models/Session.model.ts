import { Schema, model } from 'mongoose';
import crypto from 'crypto';
import { USER_ROLES } from '../../config/auth';
import { buildHiveLogger } from '../../shared';
import type { BaseDocument, UserRole } from '../../shared/types';
import type { SessionPlatform, SessionStatus, DeviceInfo, LocationInfo } from '../types/auth.types';

export interface ISessionDocument extends BaseDocument {
  userId: Schema.Types.ObjectId;
  userRole: UserRole;
  username: string;
  email?: string;
  refreshToken: string;
  refreshTokenHash: string;
  accessTokenJti?: string;
  sessionId: string;
  platform: SessionPlatform;
  status: SessionStatus;
  deviceInfo: DeviceInfo;
  deviceId: string;
  deviceFingerprint?: string;
  pushToken?: string;
  locationInfo: LocationInfo;
  ipAddress: string;
  userAgent: string;
  loginTime: Date;
  lastActivity: Date;
  expiresAt: Date;
  logoutTime?: Date;
  isSecure: boolean;
  isTrusted: boolean;
  requiresReauth: boolean;
  suspiciousActivity: boolean;
  activityLog: Array<{
    action: 'login' | 'refresh' | 'logout' | 'api_call' | 'suspicious';
    timestamp: Date;
    ip: string;
    userAgent?: string;
    endpoint?: string;
    details?: string;
  }>;
  mfaVerified: boolean;
  mfaMethod?: 'sms' | 'email' | 'totp' | 'biometric';
  mfaVerifiedAt?: Date;
  enterpriseContext?: {
    teamId?: Schema.Types.ObjectId;
    permissions?: string[];
    delegatedBy?: Schema.Types.ObjectId;
    accessLevel: 'owner' | 'admin' | 'member' | 'viewer';
  };
  concurrentSessions: number;
  maxConcurrentSessions: number;
  createdBy?: Schema.Types.ObjectId;
  revokedBy?: Schema.Types.ObjectId;
  revokedReason?: string;
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

const sessionSchema = new Schema<ISessionDocument>({
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
  refreshToken: {
    type: String,
    required: [true, 'Refresh token is required'],
    unique: true,
    select: false,
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
  deviceInfo: {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
    },
    platform: {
      type: String,
      enum: ['web', 'mobile'],
      required: true,
    },
    isMobile: {
      type: Boolean,
      required: true,
    },
    userAgent: {
      type: String,
      required: [true, 'User agent is required'],
      trim: true,
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      required: true,
    },
    browser: {
      type: String,
      trim: true,
    },
    os: {
      type: String,
      trim: true,
    },
    location: {
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
    sparse: true,
  },
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

sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ userId: 1, platform: 1 });
sessionSchema.index({ refreshTokenHash: 1, status: 1 });
sessionSchema.index({ sessionId: 1, status: 1 });
sessionSchema.index({ deviceId: 1, userId: 1 });
sessionSchema.index({ ipAddress: 1, userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ lastActivity: 1 });
sessionSchema.index({ loginTime: -1 });
sessionSchema.index({ status: 1, expiresAt: 1 });
sessionSchema.index({ suspiciousActivity: 1, status: 1 });

sessionSchema.virtual('duration').get(function() {
  if (this.logoutTime) {
    return this.logoutTime.getTime() - this.loginTime.getTime();
  }
  return Date.now() - this.loginTime.getTime();
});

sessionSchema.virtual('timeUntilExpiry').get(function() {
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

sessionSchema.pre('save', function(next) {
  if (this.isNew && this.expiresAt <= new Date()) {
    return next(new Error('Session expiration time must be in the future'));
  }
  
  if (!this.isNew) {
    this.lastActivity = new Date();
  }
  
  if (this.platform === 'web' && this.ipAddress && !this.ipAddress.startsWith('127.0.0.1')) {
    this.isSecure = true;
  }
  
  if (this.isNew) {
    buildHiveLogger.info('Session created', {
      sessionId: this.sessionId,
      userId: this.userId,
      username: this.username,
      platform: this.platform,
      deviceType: this.deviceInfo.deviceType,
      ip: this.ipAddress,
      userAgent: this.userAgent,
    });
  }
  
  next();
});

sessionSchema.pre('save', function(next) {
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

sessionSchema.methods.isValid = function(): boolean {
  return this.status === 'active' && 
         !this.isExpired() && 
         !this.suspiciousActivity;
};

sessionSchema.methods.isExpired = function(): boolean {
  return this.expiresAt <= new Date();
};

sessionSchema.methods.canRefresh = function(): boolean {
  return this.status === 'active' && 
         !this.isExpired() && 
         !this.suspiciousActivity &&
         this.refreshToken;
};

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
  
  buildHiveLogger.info('Session revoked', {
    sessionId: this.sessionId,
    userId: this.userId,
    username: this.username,
    reason,
    revokedBy,
    platform: this.platform,
  });
};

sessionSchema.methods.refresh = async function(): Promise<string> {
  if (!this.canRefresh()) {
    throw new Error('Session cannot be refreshed');
  }
  
  const newRefreshToken = crypto.randomBytes(64).toString('hex');
  const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  
  this.refreshToken = newRefreshToken;
  this.refreshTokenHash = newRefreshTokenHash;
  this.lastActivity = new Date();
  
  const extensionTime = this.platform === 'mobile' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  this.expiresAt = new Date(Date.now() + extensionTime);
  
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
  
  buildHiveLogger.security.suspiciousActivity(this.username, details, {
    sessionId: this.sessionId,
    userId: this.userId,
    platform: this.platform,
    ip: this.ipAddress,
    userAgent: this.userAgent,
  });
};

sessionSchema.methods.validateDevice = function(deviceInfo: DeviceInfo): boolean {
  const storedDevice = this.deviceInfo;
  
  if (storedDevice.deviceType !== deviceInfo.deviceType ||
      storedDevice.isMobile !== deviceInfo.isMobile) {
    return false;
  }
  
  if (deviceInfo.isMobile && storedDevice.platform && deviceInfo.platform) {
    if (storedDevice.platform !== deviceInfo.platform) {
      return false;
    }
  }
  
  return true;
};

sessionSchema.methods.updateLocation = async function(locationInfo: LocationInfo): Promise<void> {
  const currentLocation = this.locationInfo;
  let locationChanged = false;
  
  if (currentLocation.country !== locationInfo.country ||
      currentLocation.region !== locationInfo.region) {
    locationChanged = true;
  }
  
  this.locationInfo = locationInfo;
  this.ipAddress = locationInfo.ip;
  this.lastActivity = new Date();
  
  if (locationChanged) {
    this.activityLog.push({
      action: 'api_call',
      timestamp: new Date(),
      ip: locationInfo.ip,
      details: `Location changed from ${currentLocation.country}/${currentLocation.region} to ${locationInfo.country}/${locationInfo.region}`,
    });
    
    buildHiveLogger.info('Location changed', {
      sessionId: this.sessionId,
      userId: this.userId,
      username: this.username,
      oldLocation: `${currentLocation.country}/${currentLocation.region}`,
      newLocation: `${locationInfo.country}/${locationInfo.region}`,
      oldIp: currentLocation.ip,
      newIp: locationInfo.ip,
    });
  }
  
  await this.save();
};

sessionSchema.methods.extendSession = async function(minutes: number): Promise<void> {
  if (this.status !== 'active') {
    throw new Error('Cannot extend inactive session');
  }
  
  const extensionTime = minutes * 60 * 1000;
  const newExpiresAt = new Date(this.expiresAt.getTime() + extensionTime);
  
  const maxSessionDuration = this.platform === 'mobile' ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
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

sessionSchema.statics.findActiveSessions = function(userId: Schema.Types.ObjectId) {
  return this.find({
    userId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).sort({ lastActivity: -1 });
};

sessionSchema.statics.findSessionsByDevice = function(deviceId: string) {
  return this.find({
    deviceId,
    status: 'active',
  }).sort({ lastActivity: -1 });
};

sessionSchema.statics.revokeAllUserSessions = async function(userId: Schema.Types.ObjectId, reason?: string) {
  const sessions = await this.find({
    userId,
    status: 'active',
  });
  
  const updatePromises = sessions.map(session => 
    session.revoke(reason || 'All sessions revoked', userId)
  );
  
  await Promise.all(updatePromises);
  
  buildHiveLogger.info('All user sessions revoked', {
    userId,
    sessionCount: sessions.length,
    reason,
  });
  
  return sessions.length;
};

export const Session = model<ISessionDocument>('Session', sessionSchema);

export default Session;
