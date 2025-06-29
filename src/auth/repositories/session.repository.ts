import { FilterQuery, UpdateQuery, Types } from 'mongoose';
import { Session, ISessionDocument } from '../models';
import { buildHiveLogger, AuthErrorFactory } from '../../shared';
import { SESSION_STATUS, USER_ROLES } from '../../config/auth';
import type { UserRole, PaginationOptions } from '../../auth/types';

// Repository interface following Interface Segregation Principle
export interface ISessionRepository {
  // Core CRUD operations
  create(sessionData: Partial<ISessionDocument>): Promise<ISessionDocument>;
  findById(id: string): Promise<ISessionDocument | null>;
  findByUserId(userId: string): Promise<ISessionDocument[]>;
  findByRefreshToken(refreshToken: string): Promise<ISessionDocument | null>;
  update(id: string, updateData: Partial<ISessionDocument>): Promise<ISessionDocument | null>;
  delete(id: string): Promise<boolean>;
  
  // Session management operations
  createSession(userId: string, sessionData: {
    refreshToken: string;
    deviceInfo: {
      userAgent: string;
      platform: string;
      browser?: string;
      os?: string;
      deviceId?: string;
    };
    ipAddress: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
  }): Promise<ISessionDocument>;
  
  validateSession(sessionId: string, refreshToken: string): Promise<ISessionDocument | null>;
  refreshSession(sessionId: string, newRefreshToken: string): Promise<boolean>;
  revokeSession(sessionId: string): Promise<boolean>;
  revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number>;
  
  // Security operations
  findActiveSessions(userId: string): Promise<ISessionDocument[]>;
  findSuspiciousSessions(criteria: {
    multipleIPs?: boolean;
    unusualLocation?: boolean;
    oldSessions?: boolean;
  }): Promise<ISessionDocument[]>;
  
  trackLoginAttempt(userId: string, ipAddress: string, success: boolean): Promise<void>;
  getLoginAttempts(userId: string, timeWindow?: number): Promise<number>;
  
  // Cleanup operations
  cleanupExpiredSessions(): Promise<number>;
  cleanupOldSessions(olderThanDays: number): Promise<number>;
  
  // Analytics operations
  getSessionStatistics(): Promise<{
    totalActiveSessions: number;
    sessionsByPlatform: Record<string, number>;
    sessionsByRole: Record<UserRole, number>;
    averageSessionDuration: number;
    uniqueActiveUsers: number;
  }>;
  
  getUserSessionHistory(userId: string, options?: PaginationOptions): Promise<{
    sessions: ISessionDocument[];
    total: number;
  }>;
}

// Session Repository implementation following Single Responsibility Principle
export class SessionRepository implements ISessionRepository {
  private readonly model = Session;
  private readonly logger = buildHiveLogger;

  constructor() {
    this.logger.info('SessionRepository initialized', {
      model: this.model.modelName,
      collection: this.model.collection.name,
    });
  }

  // Core CRUD Operations

  /**
   * Create a new session
   * Follows Single Responsibility: Only handles session creation
   */
  async create(sessionData: Partial<ISessionDocument>): Promise<ISessionDocument> {
    try {
      this.logger.info('Creating new session', {
        userId: sessionData.userId,
        platform: sessionData.deviceInfo?.platform,
        ipAddress: sessionData.ipAddress,
      });

      // Validate required fields
      this.validateSessionData(sessionData);

      const session = new this.model(sessionData);
      const savedSession = await session.save();

      this.logger.info('Session created successfully', {
        sessionId: savedSession._id,
        userId: savedSession.userId,
        platform: savedSession.deviceInfo?.platform,
        expiresAt: savedSession.expiresAt,
      });

      // Emit session creation event
      await this.emitSessionEvent('session.created', savedSession);

      return savedSession;
    } catch (error) {
      this.logger.error('Failed to create session', error, {
        sessionData: { ...sessionData, refreshToken: '[REDACTED]' },
      });

      throw AuthErrorFactory.databaseError('Failed to create session', error);
    }
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<ISessionDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid session ID format');
      }

      const session = await this.model
        .findById(id)
        .populate('userId', 'username email role status')
        .lean()
        .exec();

      if (session) {
        this.logger.debug('Session found by ID', {
          sessionId: id,
          userId: session.userId,
          status: session.status,
        });
      }

      return session as ISessionDocument;
    } catch (error) {
      this.logger.error('Failed to find session by ID', error, { sessionId: id });
      throw AuthErrorFactory.databaseError('Failed to find session', error);
    }
  }

  /**
   * Find all sessions for a user
   */
  async findByUserId(userId: string): Promise<ISessionDocument[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const sessions = await this.model
        .find({ 
          userId: new Types.ObjectId(userId),
          status: { $ne: SESSION_STATUS.REVOKED }
        })
        .sort({ lastActivity: -1 })
        .lean()
        .exec();

      this.logger.debug('Sessions found by user ID', {
        userId,
        count: sessions.length,
      });

      return sessions as ISessionDocument[];
    } catch (error) {
      this.logger.error('Failed to find sessions by user ID', error, { userId });
      throw AuthErrorFactory.databaseError('Failed to find sessions', error);
    }
  }

  /**
   * Find session by refresh token
   */
  async findByRefreshToken(refreshToken: string): Promise<ISessionDocument | null> {
    try {
      const session = await this.model
        .findOne({ 
          refreshToken,
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        })
        .populate('userId', 'username email role status')
        .exec();

      if (session) {
        this.logger.debug('Session found by refresh token', {
          sessionId: session._id,
          userId: session.userId,
        });
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to find session by refresh token', error);
      throw AuthErrorFactory.databaseError('Failed to find session', error);
    }
  }

  /**
   * Update session data
   */
  async update(id: string, updateData: Partial<ISessionDocument>): Promise<ISessionDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid session ID format');
      }

      // Sanitize update data
      const sanitizedData = this.sanitizeUpdateData(updateData);
      sanitizedData.lastActivity = new Date();

      const session = await this.model
        .findByIdAndUpdate(
          id,
          { $set: sanitizedData },
          { new: true, runValidators: true }
        )
        .populate('userId', 'username email role status')
        .exec();

      if (!session) {
        throw AuthErrorFactory.sessionNotFound();
      }

      this.logger.info('Session updated successfully', {
        sessionId: id,
        userId: session.userId,
        updatedFields: Object.keys(sanitizedData),
      });

      // Emit session update event
      await this.emitSessionEvent('session.updated', session, { 
        updatedFields: Object.keys(sanitizedData) 
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to update session', error, { 
        sessionId: id, 
        updateData 
      });
      
      throw AuthErrorFactory.databaseError('Failed to update session', error);
    }
  }

  /**
   * Soft delete session (revoke)
   */
  async delete(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid session ID format');
      }

      const result = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              status: SESSION_STATUS.REVOKED,
              revokedAt: new Date(),
            }
          },
          { new: true }
        )
        .exec();

      if (!result) {
        throw AuthErrorFactory.sessionNotFound();
      }

      this.logger.info('Session revoked', {
        sessionId: id,
        userId: result.userId,
        revokedAt: result.revokedAt,
      });

      // Emit session revocation event
      await this.emitSessionEvent('session.revoked', result);

      return true;
    } catch (error) {
      this.logger.error('Failed to revoke session', error, { sessionId: id });
      throw AuthErrorFactory.databaseError('Failed to revoke session', error);
    }
  }

  // Session Management Operations

  /**
   * Create a new user session with comprehensive tracking
   */
  async createSession(userId: string, sessionData: {
    refreshToken: string;
    deviceInfo: {
      userAgent: string;
      platform: string;
      browser?: string;
      os?: string;
      deviceId?: string;
    };
    ipAddress: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
  }): Promise<ISessionDocument> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      // Check for existing sessions and enforce limits
      await this.enforceSessionLimits(userId, sessionData.deviceInfo.platform);

      const session = await this.create({
        userId: new Types.ObjectId(userId),
        refreshToken: sessionData.refreshToken,
        deviceInfo: sessionData.deviceInfo,
        ipAddress: sessionData.ipAddress,
        location: sessionData.location,
        status: SESSION_STATUS.ACTIVE,
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      this.logger.info('User session created', {
        sessionId: session._id,
        userId,
        platform: sessionData.deviceInfo.platform,
        ipAddress: sessionData.ipAddress,
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to create user session', error, { 
        userId, 
        sessionData: { ...sessionData, refreshToken: '[REDACTED]' }
      });
      throw AuthErrorFactory.databaseError('Failed to create session', error);
    }
  }

  /**
   * Validate session and refresh token
   */
  async validateSession(sessionId: string, refreshToken: string): Promise<ISessionDocument | null> {
    try {
      if (!Types.ObjectId.isValid(sessionId)) {
        throw AuthErrorFactory.invalidInput('Invalid session ID format');
      }

      const session = await this.model
        .findOne({
          _id: sessionId,
          refreshToken,
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        })
        .populate('userId', 'username email role status')
        .exec();

      if (session) {
        // Update last activity
        session.lastActivity = new Date();
        await session.save();

        this.logger.debug('Session validated successfully', {
          sessionId,
          userId: session.userId,
          lastActivity: session.lastActivity,
        });
      } else {
        this.logger.warn('Session validation failed', {
          sessionId,
          reason: 'Invalid session or token',
        });
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to validate session', error, { sessionId });
      throw AuthErrorFactory.databaseError('Failed to validate session', error);
    }
  }

  /**
   * Refresh session with new token
   */
  async refreshSession(sessionId: string, newRefreshToken: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(sessionId)) {
        throw AuthErrorFactory.invalidInput('Invalid session ID format');
      }

      const session = await this.model
        .findByIdAndUpdate(
          sessionId,
          {
            $set: {
              refreshToken: newRefreshToken,
              lastActivity: new Date(),
              // Extend expiry by 30 days from now
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }
          },
          { new: true }
        )
        .exec();

      if (!session) {
        throw AuthErrorFactory.sessionNotFound();
      }

      this.logger.info('Session refreshed', {
        sessionId,
        userId: session.userId,
        newExpiresAt: session.expiresAt,
      });

      // Emit session refresh event
      await this.emitSessionEvent('session.refreshed', session);

      return true;
    } catch (error) {
      this.logger.error('Failed to refresh session', error, { sessionId });
      throw AuthErrorFactory.databaseError('Failed to refresh session', error);
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      return await this.delete(sessionId);
    } catch (error) {
      this.logger.error('Failed to revoke session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Revoke all user sessions except optionally one
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const query: FilterQuery<ISessionDocument> = {
        userId: new Types.ObjectId(userId),
        status: SESSION_STATUS.ACTIVE,
      };

      // Exclude specific session if provided
      if (exceptSessionId && Types.ObjectId.isValid(exceptSessionId)) {
        query._id = { $ne: new Types.ObjectId(exceptSessionId) };
      }

      const result = await this.model
        .updateMany(
          query,
          {
            $set: {
              status: SESSION_STATUS.REVOKED,
              revokedAt: new Date(),
            }
          }
        )
        .exec();

      this.logger.info('User sessions revoked', {
        userId,
        exceptSessionId,
        revokedCount: result.modifiedCount,
      });

      // Emit bulk session revocation event
      await this.emitSessionEvent('sessions.bulk_revoked', null, {
        userId,
        exceptSessionId,
        revokedCount: result.modifiedCount,
      });

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to revoke user sessions', error, { userId, exceptSessionId });
      throw AuthErrorFactory.databaseError('Failed to revoke sessions', error);
    }
  }

  // Security Operations

  /**
   * Find active sessions for a user
   */
  async findActiveSessions(userId: string): Promise<ISessionDocument[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const sessions = await this.model
        .find({
          userId: new Types.ObjectId(userId),
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        })
        .sort({ lastActivity: -1 })
        .lean()
        .exec();

      this.logger.debug('Active sessions found', {
        userId,
        count: sessions.length,
      });

      return sessions as ISessionDocument[];
    } catch (error) {
      this.logger.error('Failed to find active sessions', error, { userId });
      throw AuthErrorFactory.databaseError('Failed to find active sessions', error);
    }
  }

  /**
   * Find suspicious sessions based on security criteria
   */
  async findSuspiciousSessions(criteria: {
    multipleIPs?: boolean;
    unusualLocation?: boolean;
    oldSessions?: boolean;
  }): Promise<ISessionDocument[]> {
    try {
      const pipeline: any[] = [
        {
          $match: {
            status: SESSION_STATUS.ACTIVE,
            expiresAt: { $gt: new Date() }
          }
        }
      ];

      // Check for multiple IPs per user
      if (criteria.multipleIPs) {
        pipeline.push(
          {
            $group: {
              _id: '$userId',
              sessions: { $push: '$$ROOT' },
              uniqueIPs: { $addToSet: '$ipAddress' },
              ipCount: { $addToSet: '$ipAddress' }
            }
          },
          {
            $match: {
              $expr: { $gt: [{ $size: '$ipCount' }, 2] }
            }
          },
          {
            $unwind: '$sessions'
          },
          {
            $replaceRoot: { newRoot: '$sessions' }
          }
        );
      }

      // Check for old sessions (active for more than 60 days)
      if (criteria.oldSessions) {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        pipeline[0].$match.createdAt = { $lt: sixtyDaysAgo };
      }

      const sessions = await this.model
        .aggregate(pipeline)
        .exec();

      this.logger.info('Suspicious sessions found', {
        criteria,
        count: sessions.length,
      });

      return sessions as ISessionDocument[];
    } catch (error) {
      this.logger.error('Failed to find suspicious sessions', error, { criteria });
      throw AuthErrorFactory.databaseError('Failed to find suspicious sessions', error);
    }
  }

  /**
   * Track login attempt for security monitoring
   */
  async trackLoginAttempt(userId: string, ipAddress: string, success: boolean): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      // Create or update login attempt tracking
      const attemptData = {
        userId: new Types.ObjectId(userId),
        ipAddress,
        success,
        timestamp: new Date(),
      };

      // Store in a separate collection or add to session metadata
      // For now, we'll emit an event for external tracking
      await this.emitSessionEvent('login.attempt', null, attemptData);

      this.logger.info('Login attempt tracked', {
        userId,
        ipAddress,
        success,
      });
    } catch (error) {
      this.logger.error('Failed to track login attempt', error, { userId, ipAddress, success });
      // Don't throw error to prevent breaking login flow
    }
  }

  /**
   * Get login attempts count for rate limiting
   */
  async getLoginAttempts(userId: string, timeWindow: number = 15): Promise<number> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return 0;
      }

      const timeWindowStart = new Date(Date.now() - timeWindow * 60 * 1000);

      // This would typically query a separate login attempts collection
      // For now, we'll return 0 and rely on external rate limiting
      const attempts = 0;

      this.logger.debug('Login attempts retrieved', {
        userId,
        timeWindow,
        attempts,
      });

      return attempts;
    } catch (error) {
      this.logger.error('Failed to get login attempts', error, { userId, timeWindow });
      return 0; 
    }
  }

  // Cleanup Operations

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.model
        .updateMany(
          {
            status: SESSION_STATUS.ACTIVE,
            expiresAt: { $lt: new Date() }
          },
          {
            $set: {
              status: SESSION_STATUS.EXPIRED,
              expiredAt: new Date(),
            }
          }
        )
        .exec();

      this.logger.info('Expired sessions cleaned up', {
        expiredCount: result.modifiedCount,
      });

      // Emit cleanup event
      await this.emitSessionEvent('sessions.expired_cleanup', null, {
        expiredCount: result.modifiedCount,
      });

      return result.modifiedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
      throw AuthErrorFactory.databaseError('Failed to cleanup expired sessions', error);
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.model
        .deleteMany({
          $or: [
            { status: SESSION_STATUS.EXPIRED },
            { status: SESSION_STATUS.REVOKED }
          ],
          createdAt: { $lt: cutoffDate }
        })
        .exec();

      this.logger.info('Old sessions cleaned up', {
        olderThanDays,
        deletedCount: result.deletedCount,
      });

      // Emit cleanup event
      await this.emitSessionEvent('sessions.old_cleanup', null, {
        olderThanDays,
        deletedCount: result.deletedCount,
      });

      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error('Failed to cleanup old sessions', error, { olderThanDays });
      throw AuthErrorFactory.databaseError('Failed to cleanup old sessions', error);
    }
  }

  // Analytics Operations

  /**
   * Get comprehensive session statistics
   */
  async getSessionStatistics(): Promise<{
    totalActiveSessions: number;
    sessionsByPlatform: Record<string, number>;
    sessionsByRole: Record<UserRole, number>;
    averageSessionDuration: number;
    uniqueActiveUsers: number;
  }> {
    try {
      const [
        totalActiveSessions,
        platformStats,
        roleStats,
        durationStats,
        uniqueUsers
      ] = await Promise.all([
        // Total active sessions
        this.model.countDocuments({
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        }),

        // Sessions by platform
        this.model.aggregate([
          {
            $match: {
              status: SESSION_STATUS.ACTIVE,
              expiresAt: { $gt: new Date() }
            }
          },
          {
            $group: {
              _id: '$deviceInfo.platform',
              count: { $sum: 1 }
            }
          }
        ]),

        // Sessions by user role (requires population)
        this.model.aggregate([
          {
            $match: {
              status: SESSION_STATUS.ACTIVE,
              expiresAt: { $gt: new Date() }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: '$user'
          },
          {
            $group: {
              _id: '$user.role',
              count: { $sum: 1 }
            }
          }
        ]),

        // Average session duration
        this.model.aggregate([
          {
            $match: {
              status: { $in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.EXPIRED] },
              lastActivity: { $exists: true }
            }
          },
          {
            $project: {
              duration: {
                $subtract: ['$lastActivity', '$createdAt']
              }
            }
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: '$duration' }
            }
          }
        ]),

        // Unique active users
        this.model.distinct('userId', {
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        })
      ]);

      // Format statistics
      const sessionsByPlatform = platformStats.reduce((acc, stat) => {
        acc[stat._id || 'unknown'] = stat.count;
        return acc;
      }, {} as Record<string, number>);

      const sessionsByRole = Object.values(USER_ROLES).reduce((acc, role) => {
        acc[role] = roleStats.find(stat => stat._id === role)?.count || 0;
        return acc;
      }, {} as Record<UserRole, number>);

      const averageSessionDuration = durationStats[0]?.avgDuration 
        ? Math.round(durationStats[0].avgDuration / (1000 * 60)) // Convert to minutes
        : 0;

      const statistics = {
        totalActiveSessions,
        sessionsByPlatform,
        sessionsByRole,
        averageSessionDuration,
        uniqueActiveUsers: uniqueUsers.length,
      };

      this.logger.info('Session statistics generated', statistics);

      return statistics;
    } catch (error) {
      this.logger.error('Failed to get session statistics', error);
      throw AuthErrorFactory.databaseError('Failed to get session statistics', error);
    }
  }

  /**
   * Get user session history with pagination
   */
  async getUserSessionHistory(userId: string, options?: PaginationOptions): Promise<{
    sessions: ISessionDocument[];
    total: number;
  }> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      const query = { userId: new Types.ObjectId(userId) };

      const [sessions, total] = await Promise.all([
        this.model
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(query)
      ]);

      this.logger.debug('User session history retrieved', {
        userId,
        count: sessions.length,
        total,
        page,
        limit,
      });

      return {
        sessions: sessions as ISessionDocument[],
        total,
      };
    } catch (error) {
      this.logger.error('Failed to get user session history', error, { userId, options });
      throw AuthErrorFactory.databaseError('Failed to get session history', error);
    }
  }

  // Private Helper Methods

  /**
   * Enforce session limits per user and platform
   */
  private async enforceSessionLimits(userId: string, platform: string): Promise<void> {
    try {
      const maxSessionsPerPlatform = platform === 'mobile' ? 3 : 5; // Mobile: 3, Web: 5
      
      const activeSessions = await this.model
        .find({
          userId: new Types.ObjectId(userId),
          'deviceInfo.platform': platform,
          status: SESSION_STATUS.ACTIVE,
          expiresAt: { $gt: new Date() }
        })
        .sort({ lastActivity: 1 }) // Oldest first
        .exec();

      if (activeSessions.length >= maxSessionsPerPlatform) {
        // Revoke oldest sessions to make room
        const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - maxSessionsPerPlatform + 1);
        
        for (const session of sessionsToRevoke) {
          await this.revokeSession(session._id.toString());
        }

        this.logger.info('Session limits enforced', {
          userId,
          platform,
          revokedCount: sessionsToRevoke.length,
          maxSessions: maxSessionsPerPlatform,
        });
      }
    } catch (error) {
      this.logger.error('Failed to enforce session limits', error, { userId, platform });
      // Don't throw error to prevent blocking new session creation
    }
  }

  /**
   * Validate session data
   */
  private validateSessionData(sessionData: Partial<ISessionDocument>): void {
    if (!sessionData.userId) {
      throw AuthErrorFactory.invalidInput('User ID is required');
    }

    if (!sessionData.refreshToken) {
      throw AuthErrorFactory.invalidInput('Refresh token is required');
    }

    if (!sessionData.deviceInfo?.platform) {
      throw AuthErrorFactory.invalidInput('Device platform is required');
    }

    if (!sessionData.ipAddress) {
      throw AuthErrorFactory.invalidInput('IP address is required');
    }

    // Validate platform
    const validPlatforms = ['web', 'mobile', 'desktop'];
    if (!validPlatforms.includes(sessionData.deviceInfo.platform)) {
      throw AuthErrorFactory.invalidInput('Invalid device platform');
    }
  }

  /**
   * Sanitize session update data
   */
  private sanitizeUpdateData(updateData: Partial<ISessionDocument>): Partial<ISessionDocument> {
    const sanitized = { ...updateData };
    
    // Remove fields that shouldn't be updated directly
    delete sanitized._id;
    delete sanitized.userId;
    delete sanitized.createdAt;
    delete sanitized.refreshToken; // Should be updated through specific methods
    
    return sanitized;
  }

  /**
   * Emit session events for event-driven architecture
   */
  private async emitSessionEvent(eventType: string, session: ISessionDocument | null, metadata?: any): Promise<void> {
    try {
      const eventData = {
        eventType,
        timestamp: new Date(),
        sessionId: session?._id,
        userId: session?.userId,
        platform: session?.deviceInfo?.platform,
        ipAddress: session?.ipAddress,
        metadata,
      };

      // Emit to Redis pub/sub for real-time notifications
      await this.publishEvent(eventType, eventData);
      
      this.logger.debug('Session event emitted', eventData);
    } catch (error) {
      this.logger.error('Failed to emit session event', error, { eventType, sessionId: session?._id });
      // Don't throw error to prevent breaking main operation
    }
  }

  /**
   * Publish event to Redis pub/sub
   */
  private async publishEvent(eventType: string, eventData: any): Promise<void> {
    // This will be implemented with Redis client
    if (this.eventPublisher) {
      await this.eventPublisher.publish(`session.${eventType}`, eventData);
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
export const sessionRepository = new SessionRepository();
export default sessionRepository;

