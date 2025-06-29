import { FilterQuery, UpdateQuery, QueryOptions, Types } from 'mongoose';
import { User, IUserDocument } from '../models';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import { USER_ROLES, USER_STATUS } from '../../config/auth';
import type { UserRole, PaginationOptions, SortOptions } from '../../auth/types';

// Repository interface following Interface Segregation Principle
export interface IUserRepository {
  // Core CRUD operations
  create(userData: Partial<IUserDocument>): Promise<IUserDocument>;
  findById(id: string): Promise<IUserDocument | null>;
  findByEmail(email: string): Promise<IUserDocument | null>;
  findByPhone(phone: string): Promise<IUserDocument | null>;
  findByUsername(username: string): Promise<IUserDocument | null>;
  findByGoogleId(googleId: string): Promise<IUserDocument | null>;
  update(id: string, updateData: Partial<IUserDocument>): Promise<IUserDocument | null>;
  delete(id: string): Promise<boolean>;
  
  // Authentication specific operations
  findByCredentials(identifier: string, password: string): Promise<IUserDocument | null>;
  findByRefreshToken(refreshToken: string): Promise<IUserDocument | null>;
  updatePassword(id: string, newPassword: string): Promise<boolean>;
  verifyEmail(id: string): Promise<boolean>;
  verifyPhone(id: string): Promise<boolean>;
  
  // Role-based operations
  findByRole(role: UserRole, options?: PaginationOptions): Promise<{
    users: IUserDocument[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  // Platform-specific operations
  findByPlatform(platform: 'web' | 'mobile', options?: PaginationOptions): Promise<{
    users: IUserDocument[];
    total: number;
  }>;
  
  // Business logic operations
  findActiveUsers(options?: PaginationOptions): Promise<IUserDocument[]>;
  findUsersRequiringVerification(): Promise<IUserDocument[]>;
  findUsersByLocation(state: string, suburb?: string): Promise<IUserDocument[]>;
  
  // Analytics and reporting
  getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<UserRole, number>;
    usersByPlatform: Record<string, number>;
    verificationStats: {
      verified: number;
      pending: number;
      rejected: number;
    };
  }>;
  
  // Bulk operations
  bulkUpdate(filter: FilterQuery<IUserDocument>, update: UpdateQuery<IUserDocument>): Promise<number>;
  bulkDelete(filter: FilterQuery<IUserDocument>): Promise<number>;
}

// User Repository implementation following Single Responsibility Principle
export class UserRepository implements IUserRepository {
  private readonly model = User;
  private readonly logger = buildHiveLogger;

  constructor() {
    this.logger.info('UserRepository initialized', {
      model: this.model.modelName,
      collection: this.model.collection.name,
    });
  }

  // Core CRUD Operations

  /**
   * Create a new user
   * Follows Single Responsibility: Only handles user creation
   */
  async create(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    try {
      this.logger.info('Creating new user', {
        role: userData.role,
        platform: userData.platform,
        authProvider: userData.authProvider,
      });

      // Validate required fields based on role and auth provider
      this.validateUserData(userData);

      const user = new this.model(userData);
      const savedUser = await user.save();

      this.logger.info('User created successfully', {
        userId: savedUser._id,
        username: savedUser.username,
        role: savedUser.role,
        platform: savedUser.platform,
      });

      // Emit user creation event for event-driven architecture
      await this.emitUserEvent('user.created', savedUser);

      return savedUser;
    } catch (error) {
      this.logger.error('Failed to create user', error, {
        userData: { ...userData, password: '[REDACTED]' },
      });

      if (error.code === 11000) {
        throw AuthErrorFactory.duplicateUser(this.getDuplicateField(error));
      }

      throw AuthErrorFactory.databaseError('Failed to create user', error);
    }
  }

  /**
   * Find user by ID
   * Optimized with lean query for performance
   */
  async findById(id: string): Promise<IUserDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const user = await this.model
        .findById(id)
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .lean()
        .exec();

      if (user) {
        this.logger.debug('User found by ID', {
          userId: id,
          username: user.username,
          role: user.role,
        });
      }

      return user as IUserDocument;
    } catch (error) {
      this.logger.error('Failed to find user by ID', error, { userId: id });
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Find user by email
   * Case-insensitive search with index optimization
   */
  async findByEmail(email: string): Promise<IUserDocument | null> {
    try {
      if (!email || !this.isValidEmail(email)) {
        throw AuthErrorFactory.invalidInput('Invalid email format');
      }

      const user = await this.model
        .findOne({ 
          email: email.toLowerCase(),
          status: { $ne: USER_STATUS.DELETED }
        })
        .select('-passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .exec();

      if (user) {
        this.logger.debug('User found by email', {
          userId: user._id,
          username: user.username,
          email: user.email,
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by email', error, { email });
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Find user by phone number
   * Supports Australian phone number formats
   */
  async findByPhone(phone: string): Promise<IUserDocument | null> {
    try {
      if (!phone || !this.isValidPhone(phone)) {
        throw AuthErrorFactory.invalidInput('Invalid phone number format');
      }

      // Normalize phone number for Australian format
      const normalizedPhone = this.normalizePhoneNumber(phone);

      const user = await this.model
        .findOne({ 
          phone: normalizedPhone,
          status: { $ne: USER_STATUS.DELETED }
        })
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .exec();

      if (user) {
        this.logger.debug('User found by phone', {
          userId: user._id,
          username: user.username,
          phone: user.phone,
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by phone', error, { phone });
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Find user by username
   * Case-insensitive search with trimming
   */
  async findByUsername(username: string): Promise<IUserDocument | null> {
    try {
      if (!username || username.trim().length < 3) {
        throw AuthErrorFactory.invalidInput('Username must be at least 3 characters');
      }

      const user = await this.model
        .findOne({ 
          username: new RegExp(`^${username.trim()}$`, 'i'),
          status: { $ne: USER_STATUS.DELETED }
        })
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .exec();

      if (user) {
        this.logger.debug('User found by username', {
          userId: user._id,
          username: user.username,
          role: user.role,
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by username', error, { username });
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Find user by Google ID
   * For OAuth authentication
   */
  async findByGoogleId(googleId: string): Promise<IUserDocument | null> {
    try {
      if (!googleId) {
        throw AuthErrorFactory.invalidInput('Google ID is required');
      }

      const user = await this.model
        .findOne({ 
          googleId,
          authProvider: 'google',
          status: { $ne: USER_STATUS.DELETED }
        })
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .exec();

      if (user) {
        this.logger.debug('User found by Google ID', {
          userId: user._id,
          username: user.username,
          googleId: user.googleId,
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by Google ID', error, { googleId });
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Update user data
   * Follows Open-Closed Principle: extensible for new update types
   */
  async update(id: string, updateData: Partial<IUserDocument>): Promise<IUserDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      // Remove sensitive fields that shouldn't be updated directly
      const sanitizedData = this.sanitizeUpdateData(updateData);
      
      // Add audit trail
      sanitizedData.updatedBy = updateData.updatedBy;
      sanitizedData.updatedAt = new Date();

      const user = await this.model
        .findByIdAndUpdate(
          id,
          { $set: sanitizedData },
          { 
            new: true, 
            runValidators: true,
            select: '-password -passwordResetToken -emailVerificationToken -phoneVerificationCode'
          }
        )
        .exec();

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      this.logger.info('User updated successfully', {
        userId: id,
        username: user.username,
        updatedFields: Object.keys(sanitizedData),
        updatedBy: updateData.updatedBy,
      });

      // Emit user update event for event-driven architecture
      await this.emitUserEvent('user.updated', user, { 
        updatedFields: Object.keys(sanitizedData),
        updatedBy: updateData.updatedBy 
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to update user', error, { 
        userId: id, 
        updateData: { ...updateData, password: '[REDACTED]' } 
      });
      
      if (error.code === 11000) {
        throw AuthErrorFactory.duplicateUser(this.getDuplicateField(error));
      }
      
      throw AuthErrorFactory.databaseError('Failed to update user', error);
    }
  }

  /**
   * Soft delete user (following GDPR compliance)
   * Dependency Inversion: depends on abstract deletion policy
   */
  async delete(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      // Soft delete - mark as deleted instead of removing
      const result = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              status: USER_STATUS.DELETED,
              deletedAt: new Date(),
              // Anonymize sensitive data for GDPR compliance
              email: `deleted_${id}@buildhive.deleted`,
              phone: null,
              googleId: null,
            }
          },
          { new: true }
        )
        .exec();

      if (!result) {
        throw AuthErrorFactory.userNotFound();
      }

      this.logger.info('User soft deleted', {
        userId: id,
        username: result.username,
        deletedAt: result.deletedAt,
      });

      // Emit user deletion event for cleanup across microservices
      await this.emitUserEvent('user.deleted', result);

      return true;
    } catch (error) {
      this.logger.error('Failed to delete user', error, { userId: id });
      throw AuthErrorFactory.databaseError('Failed to delete user', error);
    }
  }

  // Authentication Specific Operations

  /**
   * Find user by credentials for login
   * Supports email, phone, or username with password
   */
  async findByCredentials(identifier: string, password: string): Promise<IUserDocument | null> {
    try {
      if (!identifier || !password) {
        throw AuthErrorFactory.invalidCredentials();
      }

      // Build query to search by email, phone, or username
      const query = this.buildCredentialsQuery(identifier);
      
      const user = await this.model
        .findOne({
          ...query,
          status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.PENDING] }
        })
        .select('+password +loginAttempts +lockUntil')
        .exec();

      if (!user) {
        this.logger.security.loginAttempt(identifier, false, 'User not found');
        return null;
      }

      // Check if account is locked
      if (user.isLocked()) {
        this.logger.security.loginAttempt(identifier, false, 'Account locked');
        throw AuthErrorFactory.accountLocked();
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        this.logger.security.loginAttempt(identifier, false, 'Invalid password');
        throw AuthErrorFactory.invalidCredentials();
      }

      // Reset login attempts on successful login
      if (user.loginAttempts && user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      this.logger.security.loginAttempt(identifier, true, 'Login successful');

      // Emit login event for analytics and security monitoring
      await this.emitUserEvent('user.login', user);

      return user;
    } catch (error) {
      this.logger.error('Failed to authenticate user', error, { identifier });
      throw error; // Re-throw to preserve specific auth errors
    }
  }

  /**
   * Find user by refresh token
   * For JWT token refresh flow
   */
  async findByRefreshToken(refreshToken: string): Promise<IUserDocument | null> {
    try {
      if (!refreshToken) {
        throw AuthErrorFactory.invalidInput('Refresh token is required');
      }

      // Hash the refresh token to match stored hash
      const crypto = require('crypto');
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const user = await this.model
        .findOne({
          refreshTokenHash,
          status: USER_STATUS.ACTIVE,
        })
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .exec();

      if (user) {
        this.logger.debug('User found by refresh token', {
          userId: user._id,
          username: user.username,
        });
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to find user by refresh token', error);
      throw AuthErrorFactory.databaseError('Failed to find user', error);
    }
  }

  /**
   * Update user password
   * Includes password history and security checks
   */
  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      if (!this.isValidPassword(newPassword)) {
        throw AuthErrorFactory.invalidInput('Password does not meet security requirements');
      }

      const user = await this.model
        .findById(id)
        .select('+password +passwordHistory')
        .exec();

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      // Check if new password is same as current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        throw AuthErrorFactory.invalidInput('New password must be different from current password');
      }

      // Check password history (prevent reuse of last 5 passwords)
      if (user.passwordHistory && user.passwordHistory.length > 0) {
        const bcrypt = require('bcrypt');
        for (const oldPasswordHash of user.passwordHistory.slice(-5)) {
          const isOldPassword = await bcrypt.compare(newPassword, oldPasswordHash);
          if (isOldPassword) {
            throw AuthErrorFactory.invalidInput('Cannot reuse recent passwords');
          }
        }
      }

      // Add current password to history before updating
      if (user.password) {
        user.passwordHistory = user.passwordHistory || [];
        user.passwordHistory.push(user.password);
        
        // Keep only last 5 passwords
        if (user.passwordHistory.length > 5) {
          user.passwordHistory = user.passwordHistory.slice(-5);
        }
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      
      // Reset any password reset tokens
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      this.logger.security.passwordChanged(user.username, {
        userId: id,
        changedAt: user.passwordChangedAt,
      });

      // Emit password change event for security monitoring
      await this.emitUserEvent('user.password_changed', user);

      return true;
    } catch (error) {
      this.logger.error('Failed to update password', error, { userId: id });
      throw error;
    }
  }

  /**
   * Verify user email
   * Updates verification status and triggers welcome flow
   */
  async verifyEmail(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const user = await this.model
        .findByIdAndUpdate(
          id,
          {
            $set: {
              isEmailVerified: true,
              emailVerifiedAt: new Date(),
            },
            $unset: {
              emailVerificationToken: 1,
              emailVerificationExpires: 1,
            }
          },
          { new: true }
        )
        .exec();

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      this.logger.info('Email verified successfully', {
        userId: id,
        username: user.username,
        email: user.email,
        verifiedAt: user.emailVerifiedAt,
      });

      // Check if user is now fully verified
      const isFullyVerified = user.isFullyVerified();
      if (isFullyVerified && user.status === USER_STATUS.PENDING) {
        user.status = USER_STATUS.ACTIVE;
        await user.save();
      }

      // Emit email verification event
      await this.emitUserEvent('user.email_verified', user, { 
        isFullyVerified 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to verify email', error, { userId: id });
      throw AuthErrorFactory.databaseError('Failed to verify email', error);
    }
  }

  /**
   * Verify user phone
   * Updates verification status for SMS-based verification
   */
  async verifyPhone(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const user = await this.model
        .findByIdAndUpdate(
          id,
          {
            $set: {
              isPhoneVerified: true,
              phoneVerifiedAt: new Date(),
            },
            $unset: {
              phoneVerificationCode: 1,
              phoneVerificationExpires: 1,
              phoneVerificationAttempts: 1,
            }
          },
          { new: true }
        )
        .exec();

      if (!user) {
        throw AuthErrorFactory.userNotFound();
      }

      this.logger.info('Phone verified successfully', {
        userId: id,
        username: user.username,
        phone: user.phone,
        verifiedAt: user.phoneVerifiedAt,
      });

      // Check if user is now fully verified
      const isFullyVerified = user.isFullyVerified();
      if (isFullyVerified && user.status === USER_STATUS.PENDING) {
        user.status = USER_STATUS.ACTIVE;
        await user.save();
      }

      // Emit phone verification event
      await this.emitUserEvent('user.phone_verified', user, { 
        isFullyVerified 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to verify phone', error, { userId: id });
      throw AuthErrorFactory.databaseError('Failed to verify phone', error);
    }
  }

  // Role-based Operations

  /**
   * Find users by role with pagination
   * Supports BuildHive's three user roles: Client, Tradie, Enterprise
   */
  async findByRole(role: UserRole, options?: PaginationOptions): Promise<{
    users: IUserDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      if (!Object.values(USER_ROLES).includes(role)) {
        throw AuthErrorFactory.invalidInput('Invalid user role');
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'createdAt';
      const sortOrder = options?.sortOrder || 'desc';

      const query = {
        role,
        status: { $ne: USER_STATUS.DELETED }
      };

      const [users, total] = await Promise.all([
        this.model
          .find(query)
          .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(query)
      ]);

      this.logger.debug('Users found by role', {
        role,
        count: users.length,
        total,
        page,
        limit,
      });

      return {
        users: users as IUserDocument[],
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to find users by role', error, { role, options });
      throw AuthErrorFactory.databaseError('Failed to find users by role', error);
    }
  }

  /**
   * Find users by platform (web/mobile)
   * For platform-specific analytics and features
   */
  async findByPlatform(platform: 'web' | 'mobile', options?: PaginationOptions): Promise<{
    users: IUserDocument[];
    total: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 50;
      const skip = (page - 1) * limit;

      const query = {
        platform,
        status: { $ne: USER_STATUS.DELETED }
      };

      const [users, total] = await Promise.all([
        this.model
          .find(query)
          .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
          .sort({ lastLogin: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(query)
      ]);

      this.logger.debug('Users found by platform', {
        platform,
        count: users.length,
        total,
      });

      return {
        users: users as IUserDocument[],
        total,
      };
    } catch (error) {
      this.logger.error('Failed to find users by platform', error, { platform });
      throw AuthErrorFactory.databaseError('Failed to find users by platform', error);
    }
  }

  // Business Logic Operations

  /**
   * Find active users
   * For BuildHive marketplace and job matching
   */
  async findActiveUsers(options?: PaginationOptions): Promise<IUserDocument[]> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 100;
      const skip = (page - 1) * limit;

      const users = await this.model
        .find({
          status: USER_STATUS.ACTIVE,
          isEmailVerified: true,
          lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Active in last 30 days
        })
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .sort({ lastLogin: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      this.logger.debug('Active users found', {
        count: users.length,
        page,
        limit,
      });

      return users as IUserDocument[];
    } catch (error) {
      this.logger.error('Failed to find active users', error);
      throw AuthErrorFactory.databaseError('Failed to find active users', error);
    }
  }

  /**
   * Find users requiring verification
   * For admin dashboard and verification workflows
   */
  async findUsersRequiringVerification(): Promise<IUserDocument[]> {
    try {
      const users = await this.model
        .find({
          status: USER_STATUS.PENDING,
          $or: [
            { isEmailVerified: false },
            { isPhoneVerified: false }
          ]
        })
        .select('-password -passwordResetToken')
        .sort({ createdAt: 1 }) // Oldest first
        .lean()
        .exec();

      this.logger.debug('Users requiring verification found', {
        count: users.length,
      });

      return users as IUserDocument[];
    } catch (error) {
      this.logger.error('Failed to find users requiring verification', error);
      throw AuthErrorFactory.databaseError('Failed to find users requiring verification', error);
    }
  }

  /**
   * Find users by location (Australian states/suburbs)
   * For BuildHive job matching and local services
   */
  async findUsersByLocation(state: string, suburb?: string): Promise<IUserDocument[]> {
    try {
      if (!this.isValidAustralianState(state)) {
        throw AuthErrorFactory.invalidInput('Invalid Australian state');
      }

      const query: any = {
        status: USER_STATUS.ACTIVE,
        'profile.address.state': state.toUpperCase(),
      };

      if (suburb) {
        query['profile.address.suburb'] = new RegExp(suburb, 'i');
      }

      const users = await this.model
        .find(query)
        .populate('profile', 'address businessInfo tradieInfo')
        .select('-password -passwordResetToken -emailVerificationToken -phoneVerificationCode')
        .sort({ 'profile.ratings.overall': -1 })
        .lean()
        .exec();

      this.logger.debug('Users found by location', {
        state,
        suburb,
        count: users.length,
      });

      return users as IUserDocument[];
    } catch (error) {
      this.logger.error('Failed to find users by location', error, { state, suburb });
      throw AuthErrorFactory.databaseError('Failed to find users by location', error);
    }
  }
  
  // Analytics and Reporting

  /**
   * Get comprehensive user statistics
   * For admin dashboard and business intelligence
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<UserRole, number>;
    usersByPlatform: Record<string, number>;
    verificationStats: {
      verified: number;
      pending: number;
      rejected: number;
    };
  }> {
    try {
      const [
        totalUsers,
        activeUsers,
        roleStats,
        platformStats,
        verificationStats
      ] = await Promise.all([
        // Total users (excluding deleted)
        this.model.countDocuments({ status: { $ne: USER_STATUS.DELETED } }),
        
        // Active users
        this.model.countDocuments({ status: USER_STATUS.ACTIVE }),
        
        // Users by role
        this.model.aggregate([
          { $match: { status: { $ne: USER_STATUS.DELETED } } },
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        
        // Users by platform
        this.model.aggregate([
          { $match: { status: { $ne: USER_STATUS.DELETED } } },
          { $group: { _id: '$platform', count: { $sum: 1 } } }
        ]),
        
        // Verification statistics
        this.model.aggregate([
          { $match: { status: { $ne: USER_STATUS.DELETED } } },
          {
            $group: {
              _id: null,
              verified: {
                $sum: {
                  $cond: [
                    { $and: ['$isEmailVerified', '$isPhoneVerified'] },
                    1,
                    0
                  ]
                }
              },
              pending: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', USER_STATUS.PENDING] },
                    1,
                    0
                  ]
                }
              },
              rejected: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', USER_STATUS.SUSPENDED] },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ])
      ]);

      // Format role statistics
      const usersByRole = Object.values(USER_ROLES).reduce((acc, role) => {
        acc[role] = roleStats.find(stat => stat._id === role)?.count || 0;
        return acc;
      }, {} as Record<UserRole, number>);

      // Format platform statistics
      const usersByPlatform = platformStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>);

      const stats = {
        totalUsers,
        activeUsers,
        usersByRole,
        usersByPlatform,
        verificationStats: verificationStats[0] || {
          verified: 0,
          pending: 0,
          rejected: 0,
        },
      };

      this.logger.info('User statistics generated', stats);

      return stats;
    } catch (error) {
      this.logger.error('Failed to get user statistics', error);
      throw AuthErrorFactory.databaseError('Failed to get user statistics', error);
    }
  }

  // Bulk Operations

  /**
   * Bulk update users
   * For administrative operations and data migrations
   */
  async bulkUpdate(filter: FilterQuery<IUserDocument>, update: UpdateQuery<IUserDocument>): Promise<number> {
    try {
      // Sanitize update data to prevent unauthorized changes
      const sanitizedUpdate = this.sanitizeBulkUpdate(update);
      
      const result = await this.model
        .updateMany(filter, sanitizedUpdate)
        .exec();

      this.logger.info('Bulk update completed', {
        filter,
        update: sanitizedUpdate,
        modifiedCount: result.modifiedCount,
      });

      // Emit bulk update event for audit trail
      await this.emitUserEvent('users.bulk_updated', null, {
        filter,
        update: sanitizedUpdate,
        modifiedCount: result.modifiedCount,
      });

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to bulk update users', error, { filter, update });
      throw AuthErrorFactory.databaseError('Failed to bulk update users', error);
    }
  }

  /**
   * Bulk delete users (soft delete)
   * For GDPR compliance and data cleanup
   */
  async bulkDelete(filter: FilterQuery<IUserDocument>): Promise<number> {
    try {
      // Prevent accidental deletion of all users
      if (Object.keys(filter).length === 0) {
        throw AuthErrorFactory.invalidInput('Bulk delete requires specific filter criteria');
      }

      const result = await this.model
        .updateMany(
          filter,
          {
            $set: {
              status: USER_STATUS.DELETED,
              deletedAt: new Date(),
            }
          }
        )
        .exec();

      this.logger.info('Bulk delete completed', {
        filter,
        modifiedCount: result.modifiedCount,
      });

      // Emit bulk delete event for cleanup across microservices
      await this.emitUserEvent('users.bulk_deleted', null, {
        filter,
        modifiedCount: result.modifiedCount,
      });

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to bulk delete users', error, { filter });
      throw AuthErrorFactory.databaseError('Failed to bulk delete users', error);
    }
  }

  // Private Helper Methods (following Single Responsibility Principle)

  /**
   * Validate user data based on role and auth provider
   */
  private validateUserData(userData: Partial<IUserDocument>): void {
    if (!userData.role || !Object.values(USER_ROLES).includes(userData.role)) {
      throw AuthErrorFactory.invalidInput('Valid user role is required');
    }

    if (!userData.platform || !['web', 'mobile'].includes(userData.platform)) {
      throw AuthErrorFactory.invalidInput('Valid platform is required');
    }

    if (!userData.authProvider || !['local', 'google'].includes(userData.authProvider)) {
      throw AuthErrorFactory.invalidInput('Valid auth provider is required');
    }

    // Role-specific validation
    if (userData.role === USER_ROLES.TRADIE) {
      if (!userData.phone) {
        throw AuthErrorFactory.invalidInput('Phone number is required for tradies');
      }
    }

    if (userData.role === USER_ROLES.ENTERPRISE) {
      if (!userData.email) {
        throw AuthErrorFactory.invalidInput('Email is required for enterprise users');
      }
    }
  }

  /**
   * Build credentials query for multi-identifier login
   */
  private buildCredentialsQuery(identifier: string): FilterQuery<IUserDocument> {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    
    // Check if it's an email
    if (this.isValidEmail(normalizedIdentifier)) {
      return { email: normalizedIdentifier };
    }
    
    // Check if it's a phone number
    if (this.isValidPhone(normalizedIdentifier)) {
      return { phone: this.normalizePhoneNumber(normalizedIdentifier) };
    }
    
    // Otherwise treat as username
    return { username: new RegExp(`^${normalizedIdentifier}$`, 'i') };
  }

  /**
   * Sanitize update data to prevent unauthorized field updates
   */
  private sanitizeUpdateData(updateData: Partial<IUserDocument>): Partial<IUserDocument> {
    const sanitized = { ...updateData };
    
    // Remove sensitive fields that shouldn't be updated directly
    delete sanitized.password;
    delete sanitized.passwordResetToken;
    delete sanitized.passwordResetExpires;
    delete sanitized.emailVerificationToken;
    delete sanitized.emailVerificationExpires;
    delete sanitized.phoneVerificationCode;
    delete sanitized.phoneVerificationExpires;
    delete sanitized.refreshTokenHash;
    delete sanitized.loginAttempts;
    delete sanitized.lockUntil;
    delete sanitized._id;
    delete sanitized.createdAt;
    
    return sanitized;
  }

  /**
   * Sanitize bulk update data
   */
  private sanitizeBulkUpdate(update: UpdateQuery<IUserDocument>): UpdateQuery<IUserDocument> {
    const sanitized = { ...update };
    
    // Remove dangerous operations
    delete sanitized.$unset?.password;
    delete sanitized.$unset?.refreshTokenHash;
    delete sanitized.$set?.password;
    delete sanitized.$set?.refreshTokenHash;
    
    return sanitized;
  }

  /**
   * Get duplicate field from MongoDB error
   */
  private getDuplicateField(error: any): string {
    if (error.keyPattern?.email) return 'email';
    if (error.keyPattern?.phone) return 'phone';
    if (error.keyPattern?.username) return 'username';
    if (error.keyPattern?.googleId) return 'googleId';
    return 'unknown field';
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Australian phone number
   */
  private isValidPhone(phone: string): boolean {
    // Australian phone number patterns
    const phoneRegex = /^(\+61|0)[2-9]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Normalize Australian phone number
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove spaces and convert to +61 format
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.startsWith('0')) {
      return '+61' + cleaned.substring(1);
    }
    if (cleaned.startsWith('+61')) {
      return cleaned;
    }
    return '+61' + cleaned;
  }

  /**
   * Validate password strength
   */
  private isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  /**
   * Validate Australian state
   */
  private isValidAustralianState(state: string): boolean {
    const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
    return validStates.includes(state.toUpperCase());
  }

  /**
   * Emit user events for event-driven architecture
   */
  private async emitUserEvent(eventType: string, user: IUserDocument | null, metadata?: any): Promise<void> {
    try {
      const eventData = {
        eventType,
        timestamp: new Date(),
        userId: user?._id,
        username: user?.username,
        role: user?.role,
        platform: user?.platform,
        metadata,
      };

      // Emit to Redis pub/sub for real-time notifications
      await this.publishEvent(eventType, eventData);
      
      this.logger.debug('User event emitted', eventData);
    } catch (error) {
      this.logger.error('Failed to emit user event', error, { eventType, userId: user?._id });
      // Don't throw error to prevent breaking main operation
    }
  }

  /**
   * Publish event to Redis pub/sub
   */
  private async publishEvent(eventType: string, eventData: any): Promise<void> {
    // This will be implemented with Redis client
    // For now, we'll use a placeholder that can be injected
    if (this.eventPublisher) {
      await this.eventPublisher.publish(`user.${eventType}`, eventData);
    }
  }

  // Event publisher dependency injection (Dependency Inversion Principle)
  private eventPublisher?: {
    publish(channel: string, data: any): Promise<void>;
  };

  /**
   * Set event publisher for dependency injection
   */
  setEventPublisher(publisher: { publish(channel: string, data: any): Promise<void> }): void {
    this.eventPublisher = publisher;
  }
}

// Export repository instance and interface
export const userRepository = new UserRepository();
export default userRepository;
  
