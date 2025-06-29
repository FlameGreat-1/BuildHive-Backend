import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES, USER_STATUS, VERIFICATION_STATUS, PASSWORD_CONFIG } from '../../config/auth';
import { buildHiveLogger } from '../../shared';
import type { BaseDocument, UserRole, UserStatus, VerificationStatus } from '../../shared/types';

// Platform types for registration source
export type PlatformType = 'web' | 'mobile';
export type AuthProvider = 'local' | 'google';

// User document interface extending BaseDocument
export interface IUserDocument extends BaseDocument {
  // Core Authentication Fields
  username: string;
  email?: string; // Optional for mobile phone registration
  phone?: string; // Required for mobile, optional for web
  password?: string; // Optional when using OAuth only
  
  // User Classification
  role: UserRole;
  status: UserStatus;
  platform: PlatformType;
  authProvider: AuthProvider;
  
  // Google OAuth Integration
  googleId?: string;
  googleEmail?: string;
  googleAvatar?: string;
  
  // Email Verification
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  
  // Phone Verification
  isPhoneVerified: boolean;
  phoneVerificationCode?: string;
  phoneVerificationExpires?: Date;
  phoneVerificationAttempts: number;
  
  // Overall Verification Status
  verificationStatus: VerificationStatus;
  
  // Password Reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordChangedAt?: Date;
  
  // Security & Login Management
  loginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginPlatform?: PlatformType;
  
  // Profile Reference
  profileId?: Schema.Types.ObjectId;
  
  // Subscription & Credits System (BuildHive Monetization)
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    startDate?: Date;
    endDate?: Date;
    autoRenew: boolean;
    billingCycle?: 'monthly' | 'yearly';
  };
  credits: number;
  creditHistory?: Array<{
    amount: number;
    type: 'purchase' | 'usage' | 'refund' | 'bonus';
    description: string;
    timestamp: Date;
  }>;
  
  // Enterprise Team Management
  enterpriseTeam?: {
    isOwner: boolean;
    ownerId?: Schema.Types.ObjectId;
    teamMembers?: Schema.Types.ObjectId[];
    permissions?: Array<'manage_team' | 'assign_jobs' | 'view_analytics' | 'manage_billing' | 'manage_settings'>;
    invitationCode?: string;
  };
  
  // Device & Session Management
  devices?: Array<{
    deviceId: string;
    platform: PlatformType;
    deviceInfo: string;
    lastActive: Date;
    pushToken?: string; // For mobile notifications
  }>;
  
  // Audit Trail
  createdBy?: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  registrationIP?: string;
  
  // Instance Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
  createPhoneVerificationCode(): string;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  isFullyVerified(): boolean;
  canApplyToJobs(): boolean;
  canPostJobs(): boolean;
  canManageTeam(): boolean;
  hasActiveSubscription(): boolean;
  deductCredits(amount: number, description: string): Promise<boolean>;
  addCredits(amount: number, type: string, description: string): Promise<void>;
  addDevice(deviceInfo: any): Promise<void>;
  removeDevice(deviceId: string): Promise<void>;
}

// User Schema Definition
const userSchema = new Schema<IUserDocument>({
  // Core Authentication Fields
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must not exceed 30 characters'],
    match: [
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores'
    ],
    index: true,
  },
  
  email: {
    type: String,
    sparse: true, // Allows multiple null values
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address'
    ],
    index: true,
  },
  
  phone: {
    type: String,
    sparse: true, // Allows multiple null values
    trim: true,
    match: [
      /^\+?[1-9]\d{1,14}$/,
      'Please provide a valid phone number'
    ],
    index: true,
  },
  
  password: {
    type: String,
    minlength: [PASSWORD_CONFIG.MIN_LENGTH, `Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`],
    maxlength: [PASSWORD_CONFIG.MAX_LENGTH, `Password must not exceed ${PASSWORD_CONFIG.MAX_LENGTH} characters`],
    select: false, // Don't include password in queries by default
  },
  
  // User Classification
  role: {
    type: String,
    enum: {
      values: Object.values(USER_ROLES),
      message: 'Role must be one of: {VALUES}'
    },
    required: [true, 'User role is required'],
    index: true,
  },
  
  status: {
    type: String,
    enum: {
      values: Object.values(USER_STATUS),
      message: 'Status must be one of: {VALUES}'
    },
    default: USER_STATUS.ACTIVE,
    index: true,
  },
  
  platform: {
    type: String,
    enum: {
      values: ['web', 'mobile'],
      message: 'Platform must be either web or mobile'
    },
    required: [true, 'Registration platform is required'],
    index: true,
  },
  
  authProvider: {
    type: String,
    enum: {
      values: ['local', 'google'],
      message: 'Auth provider must be local or google'
    },
    default: 'local',
    index: true,
  },
  
  // Google OAuth Integration
  googleId: {
    type: String,
    sparse: true,
    index: true,
  },
  
  googleEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  googleAvatar: {
    type: String,
    trim: true,
  },
  
  // Email Verification
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  emailVerificationToken: {
    type: String,
    select: false,
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  
  // Phone Verification
  isPhoneVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  phoneVerificationCode: {
    type: String,
    select: false,
  },
  
  phoneVerificationExpires: {
    type: Date,
    select: false,
  },
  
  phoneVerificationAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  
  // Overall Verification Status
  verificationStatus: {
    type: String,
    enum: {
      values: Object.values(VERIFICATION_STATUS),
      message: 'Verification status must be one of: {VALUES}'
    },
    default: VERIFICATION_STATUS.PENDING,
    index: true,
  },
  
  // Password Reset
  passwordResetToken: {
    type: String,
    select: false,
  },
  
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  
  passwordChangedAt: {
    type: Date,
    select: false,
  },
  
  // Security & Login Management
  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  
  lockUntil: {
    type: Date,
    select: false,
  },
  
  lastLogin: {
    type: Date,
    index: true,
  },
  
  lastLoginIP: {
    type: String,
    trim: true,
  },
  
  lastLoginPlatform: {
    type: String,
    enum: ['web', 'mobile'],
  },
  
  // Profile Reference
  profileId: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    index: true,
  },

  // Subscription & Credits System (BuildHive Monetization)
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active',
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: false,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
  },
  
  credits: {
    type: Number,
    default: 0,
    min: [0, 'Credits cannot be negative'],
    index: true,
  },
  
  creditHistory: [{
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'usage', 'refund', 'bonus'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Enterprise Team Management
  enterpriseTeam: {
    isOwner: {
      type: Boolean,
      default: false,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    teamMembers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    permissions: [{
      type: String,
      enum: ['manage_team', 'assign_jobs', 'view_analytics', 'manage_billing', 'manage_settings'],
    }],
    invitationCode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  
  // Device & Session Management
  devices: [{
    deviceId: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['web', 'mobile'],
      required: true,
    },
    deviceInfo: {
      type: String,
      required: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    pushToken: String, // For mobile push notifications
  }],
  
  // Audit Trail
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  
  registrationIP: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  versionKey: false,
  collection: 'users',
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.phoneVerificationCode;
      delete ret.phoneVerificationExpires;
      delete ret.loginAttempts;
      delete ret.lockUntil;
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
userSchema.index({ username: 1, status: 1 });
userSchema.index({ email: 1, status: 1 }, { sparse: true });
userSchema.index({ phone: 1, status: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ platform: 1, authProvider: 1 });
userSchema.index({ verificationStatus: 1 });
userSchema.index({ 'subscription.status': 1, role: 1 });
userSchema.index({ credits: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'enterpriseTeam.ownerId': 1 }, { sparse: true });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified and exists
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    // Set password changed timestamp
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }
    
    buildHiveLogger.info('Password hashed successfully', {
      userId: this._id,
      username: this.username,
      platform: this.platform,
    });
    
    next();
  } catch (error) {
    buildHiveLogger.error('Password hashing failed', error, {
      userId: this._id,
      username: this.username,
    });
    next(error);
  }
});

// Pre-save middleware for validation
userSchema.pre('save', function(next) {
  // Ensure either email or phone is provided
  if (!this.email && !this.phone) {
    return next(new Error('Either email or phone number is required'));
  }
  
  // Password is required for local auth provider
  if (this.authProvider === 'local' && !this.password) {
    return next(new Error('Password is required for local authentication'));
  }
  
  // Google ID is required for Google auth provider
  if (this.authProvider === 'google' && !this.googleId) {
    return next(new Error('Google ID is required for Google authentication'));
  }
  
  // Set up enterprise team structure for enterprise users
  if (this.role === USER_ROLES.ENTERPRISE && !this.enterpriseTeam) {
    this.enterpriseTeam = {
      isOwner: true,
      teamMembers: [],
      permissions: ['manage_team', 'assign_jobs', 'view_analytics', 'manage_billing', 'manage_settings'],
      invitationCode: require('crypto').randomBytes(8).toString('hex').toUpperCase(),
    };
  }
  
  next();
});

// Instance Methods

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    buildHiveLogger.error('Password comparison failed', error, {
      userId: this._id,
      username: this.username,
    });
    return false;
  }
};

// Check if account is locked
userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function(): Promise<void> {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // If we've reached max attempts and it's not locked yet, lock the account
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
    
    buildHiveLogger.security.accountLocked(this.username, {
      userId: this._id,
      attempts: this.loginAttempts + 1,
      lockUntil: updates.$set.lockUntil,
      platform: this.platform,
    });
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  });
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function(): string {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function(): string {
  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  
  this.emailVerificationToken = require('crypto')
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return verificationToken;
};

// Create phone verification code
userSchema.methods.createPhoneVerificationCode = function(): string {
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  
  this.phoneVerificationCode = require('crypto')
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');
  
  this.phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.phoneVerificationAttempts = 0;
  
  return verificationCode;
};

// Check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      (this.passwordChangedAt.getTime() / 1000).toString(),
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Check if user is fully verified
userSchema.methods.isFullyVerified = function(): boolean {
  const emailVerified = !this.email || this.isEmailVerified;
  const phoneVerified = !this.phone || this.isPhoneVerified;
  return emailVerified && phoneVerified;
};

// Business logic methods for BuildHive features

// Check if user can apply to jobs (Tradies only)
userSchema.methods.canApplyToJobs = function(): boolean {
  return this.role === USER_ROLES.TRADIE && 
         this.status === USER_STATUS.ACTIVE && 
         this.isFullyVerified();
};

// Check if user can post jobs (Clients and Enterprise)
userSchema.methods.canPostJobs = function(): boolean {
  return (this.role === USER_ROLES.CLIENT || this.role === USER_ROLES.ENTERPRISE) &&
         this.status === USER_STATUS.ACTIVE &&
         this.isFullyVerified();
};

// Check if user can manage team (Enterprise only)
userSchema.methods.canManageTeam = function(): boolean {
  return this.role === USER_ROLES.ENTERPRISE &&
         this.status === USER_STATUS.ACTIVE &&
         this.enterpriseTeam?.isOwner === true;
};

// Check if user has active subscription
userSchema.methods.hasActiveSubscription = function(): boolean {
  return this.subscription?.status === 'active' &&
         this.subscription?.endDate &&
         this.subscription.endDate > new Date();
};

// Deduct credits with history tracking
userSchema.methods.deductCredits = async function(amount: number, description: string): Promise<boolean> {
  if (this.credits < amount) {
    return false;
  }
  
  this.credits -= amount;
  this.creditHistory?.push({
    amount: -amount,
    type: 'usage',
    description,
    timestamp: new Date(),
  });
  
  await this.save();
  
  buildHiveLogger.info('Credits deducted', {
    userId: this._id,
    username: this.username,
    amount,
    remainingCredits: this.credits,
    description,
  });
  
  return true;
};

// Add credits with history tracking
userSchema.methods.addCredits = async function(amount: number, type: string, description: string): Promise<void> {
  this.credits += amount;
  this.creditHistory?.push({
    amount,
    type: type as any,
    description,
    timestamp: new Date(),
  });
  
  await this.save();
  
  buildHiveLogger.info('Credits added', {
    userId: this._id,
    username: this.username,
    amount,
    totalCredits: this.credits,
    type,
    description,
  });
};

// Add device to user's device list
userSchema.methods.addDevice = async function(deviceInfo: any): Promise<void> {
  const existingDevice = this.devices?.find(d => d.deviceId === deviceInfo.deviceId);
  
  if (existingDevice) {
    existingDevice.lastActive = new Date();
    existingDevice.pushToken = deviceInfo.pushToken;
  } else {
    this.devices?.push({
      deviceId: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      deviceInfo: deviceInfo.deviceInfo,
      lastActive: new Date(),
      pushToken: deviceInfo.pushToken,
    });
  }
  
  await this.save();
};

// Remove device from user's device list
userSchema.methods.removeDevice = async function(deviceId: string): Promise<void> {
  if (this.devices) {
    this.devices = this.devices.filter(d => d.deviceId !== deviceId);
    await this.save();
  }
};

// Create and export the User model
export const User = model<IUserDocument>('User', userSchema);

export default User;
