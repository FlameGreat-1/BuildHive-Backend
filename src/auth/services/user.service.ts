import { Types } from 'mongoose';
import { IUserRepository, IProfileRepository, ISessionRepository } from '../repositories';
import { buildHiveLogger, AuthErrorFactory, buildHiveResponse } from '../../shared';
import { USER_ROLES, USER_STATUS, VERIFICATION_STATUS } from '../../config';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserPasswordRequest,
  UpdateUserStatusRequest,
  UserProfile,
  DetailedUserProfile,
  UserListItem,
  UserQueryParams,
  UserFilterOptions,
  UserStatistics,
  UpdateSubscriptionRequest,
  CreditTransactionRequest,
  CreditBalance,
  BulkUserOperation,
  BulkOperationResult,
  UserResponse,
  DetailedUserResponse,
  UserListResponse,
  UserStatisticsResponse
} from '../types';
import { IUserDocument, IProfileDocument } from '../models';

export interface IUserService {
  createUser(request: CreateUserRequest): Promise<UserResponse>;
  getUserById(userId: string): Promise<DetailedUserResponse>;
  getUserProfile(userId: string): Promise<UserResponse>;
  updateUser(userId: string, request: UpdateUserRequest): Promise<UserResponse>;
  updateUserPassword(userId: string, request: UpdateUserPasswordRequest): Promise<UserResponse>;
  updateUserStatus(userId: string, request: UpdateUserStatusRequest): Promise<UserResponse>;
  getUsers(params: UserQueryParams): Promise<UserListResponse>;
  getUserStatistics(): Promise<UserStatisticsResponse>;
  updateSubscription(userId: string, request: UpdateSubscriptionRequest): Promise<UserResponse>;
  processCreditTransaction(request: CreditTransactionRequest): Promise<CreditBalance>;
  getCreditBalance(userId: string): Promise<CreditBalance>;
  bulkUpdateUsers(operation: BulkUserOperation): Promise<BulkOperationResult>;
  deactivateUser(userId: string, reason?: string): Promise<UserResponse>;
  reactivateUser(userId: string): Promise<UserResponse>;
  deleteUser(userId: string, hardDelete?: boolean): Promise<boolean>;
  checkEmailAvailability(email: string): Promise<{ available: boolean; message: string }>;
  checkPhoneAvailability(phone: string): Promise<{ available: boolean; message: string }>;
  getVerificationStatus(userId: string): Promise<{ email: boolean; phone: boolean; isFullyVerified: boolean }>;
}

export interface IEventPublisher {
  publish(channel: string, event: any): Promise<void>;
}

export interface IEmailService {
  sendAccountStatusEmail(email: string, username: string, status: string, reason?: string): Promise<void>;
  sendSubscriptionUpdateEmail(email: string, username: string, plan: string): Promise<void>;
  sendCreditTransactionEmail(email: string, username: string, transaction: any): Promise<void>;
}

export class UserService implements IUserService {
  private readonly userRepository: IUserRepository;
  private readonly profileRepository: IProfileRepository;
  private readonly sessionRepository: ISessionRepository;
  private readonly emailService: IEmailService;
  private readonly eventPublisher: IEventPublisher;
  private readonly logger = buildHiveLogger;

  constructor(
    userRepository: IUserRepository,
    profileRepository: IProfileRepository,
    sessionRepository: ISessionRepository,
    emailService: IEmailService,
    eventPublisher: IEventPublisher
  ) {
    this.userRepository = userRepository;
    this.profileRepository = profileRepository;
    this.sessionRepository = sessionRepository;
    this.emailService = emailService;
    this.eventPublisher = eventPublisher;

    this.logger.info('UserService initialized', {
      service: 'UserService',
      dependencies: ['UserRepository', 'ProfileRepository', 'SessionRepository', 'EmailService', 'EventPublisher']
    });
  }

  async createUser(request: CreateUserRequest): Promise<UserResponse> {
    try {
      this.logger.info('Creating user', {
        username: request.username,
        role: request.role,
        platform: request.platform,
        authProvider: request.authProvider
      });

      await this.validateCreateUserRequest(request);
      await this.checkUserUniqueness(request);

      const userData = this.buildUserData(request);
      const user = await this.userRepository.create(userData);

      const userProfile = this.mapToUserProfile(user);

      await this.publishUserEvent('user.created', user, { createdBy: request.username });

      this.logger.info('User created successfully', {
        userId: user.id,
        username: user.username,
        role: user.role
      });

      return buildHiveResponse.success(userProfile, 'User created successfully');

    } catch (error) {
      this.logger.error('Failed to create user', error, {
        username: request.username,
        role: request.role
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.userCreationFailed('Failed to create user', error);
    }
  }

  async getUserById(userId: string): Promise<DetailedUserResponse> {
    try {
      this.logger.debug('Fetching user by ID', { userId });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const profile = await this.profileRepository.findByUserId(userId);
      const sessions = await this.sessionRepository.findActiveByUserId(userId);

      const detailedProfile = await this.mapToDetailedUserProfile(user, profile, sessions);

      this.logger.debug('User fetched successfully', {
        userId: user.id,
        username: user.username
      });

      return buildHiveResponse.success(detailedProfile, 'User retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch user', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.userNotFound(userId);
    }
  }

  async getUserProfile(userId: string): Promise<UserResponse> {
    try {
      this.logger.debug('Fetching user profile', { userId });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const userProfile = this.mapToUserProfile(user);

      return buildHiveResponse.success(userProfile, 'User profile retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch user profile', error, { userId });
      throw AuthErrorFactory.userNotFound(userId);
    }
  }

  async updateUser(userId: string, request: UpdateUserRequest): Promise<UserResponse> {
    try {
      this.logger.info('Updating user', { userId, updatedBy: request.updatedBy });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      await this.validateUpdateUserRequest(request, user);

      const updateData = this.buildUpdateData(request);
      const updatedUser = await this.userRepository.update(userId, updateData);

      if (!updatedUser) {
        throw AuthErrorFactory.userUpdateFailed('Failed to update user');
      }

      const userProfile = this.mapToUserProfile(updatedUser);

      await this.publishUserEvent('user.updated', updatedUser, {
        updatedBy: request.updatedBy,
        changes: updateData
      });

      this.logger.info('User updated successfully', {
        userId: updatedUser.id,
        updatedBy: request.updatedBy
      });

      return buildHiveResponse.success(userProfile, 'User updated successfully');

    } catch (error) {
      this.logger.error('Failed to update user', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.userUpdateFailed('Failed to update user', error);
    }
  }

  async updateUserPassword(userId: string, request: UpdateUserPasswordRequest): Promise<UserResponse> {
    try {
      this.logger.info('Updating user password', { userId });

      const user = await this.userRepository.findByCredentials(userId, request.currentPassword);
      if (!user) {
        throw AuthErrorFactory.invalidCredentials();
      }

      if (request.newPassword !== request.confirmPassword) {
        throw AuthErrorFactory.passwordMismatch();
      }

      await this.validatePasswordStrength(request.newPassword);
      await this.userRepository.updatePassword(userId, request.newPassword);

      if (request.logoutOtherSessions) {
        await this.sessionRepository.revokeAllUserSessions(userId);
      }

      const updatedUser = await this.userRepository.findById(userId);
      const userProfile = this.mapToUserProfile(updatedUser!);

      await this.publishUserEvent('user.password_changed', updatedUser!, { userId });

      this.logger.info('User password updated successfully', { userId });

      return buildHiveResponse.success(userProfile, 'Password updated successfully');

    } catch (error) {
      this.logger.error('Failed to update user password', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.passwordChangeFailed('Failed to update password', error);
    }
  }

  async updateUserStatus(userId: string, request: UpdateUserStatusRequest): Promise<UserResponse> {
    try {
      this.logger.info('Updating user status', {
        userId,
        newStatus: request.status,
        updatedBy: request.updatedBy,
        reason: request.reason
      });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const oldStatus = user.status;
      await this.userRepository.updateStatus(userId, request.status);

      if (request.status === USER_STATUS.SUSPENDED) {
        await this.sessionRepository.revokeAllUserSessions(userId);
      }

      const updatedUser = await this.userRepository.findById(userId);
      const userProfile = this.mapToUserProfile(updatedUser!);

      if (request.notifyUser && updatedUser!.email) {
        await this.emailService.sendAccountStatusEmail(
          updatedUser!.email,
          updatedUser!.username,
          request.status,
          request.reason
        );
      }

      await this.publishUserEvent('user.status_changed', updatedUser!, {
        oldStatus,
        newStatus: request.status,
        updatedBy: request.updatedBy,
        reason: request.reason
      });

      this.logger.info('User status updated successfully', {
        userId,
        oldStatus,
        newStatus: request.status
      });

      return buildHiveResponse.success(userProfile, 'User status updated successfully');

    } catch (error) {
      this.logger.error('Failed to update user status', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.userUpdateFailed('Failed to update user status', error);
    }
  }

  async getUsers(params: UserQueryParams): Promise<UserListResponse> {
    try {
      this.logger.debug('Fetching users with filters', {
        page: params.page,
        limit: params.limit,
        role: params.role,
        status: params.status
      });

      const filters = this.buildUserFilters(params);
      const options = {
        page: params.page || 1,
        limit: Math.min(params.limit || 20, 100),
        sort: this.buildSortOptions(params.sort, params.order)
      };

      const result = await this.userRepository.findPaginated(filters, options);
      const userList = result.docs.map(user => this.mapToUserListItem(user));

      const statistics = await this.calculateFilterStatistics(result.docs);

      this.logger.debug('Users fetched successfully', {
        total: result.totalDocs,
        page: result.page,
        totalPages: result.totalPages
      });

      return {
        success: true,
        message: 'Users retrieved successfully',
        data: userList,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.totalDocs,
          totalPages: result.totalPages,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        },
        filters: params,
        statistics,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1'
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch users', error, { params });
      throw AuthErrorFactory.userFetchFailed('Failed to fetch users', error);
    }
  }

  async getUserStatistics(): Promise<UserStatisticsResponse> {
    try {
      this.logger.debug('Calculating user statistics');

      const totalUsers = await this.userRepository.count({});
      const activeUsers = await this.userRepository.count({ status: USER_STATUS.ACTIVE });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const newUsersToday = await this.userRepository.count({ 
        createdAt: { $gte: today } 
      });
      const newUsersThisWeek = await this.userRepository.count({ 
        createdAt: { $gte: thisWeek } 
      });
      const newUsersThisMonth = await this.userRepository.count({ 
        createdAt: { $gte: thisMonth } 
      });

      const usersByRole = await this.userRepository.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      const usersByStatus = await this.userRepository.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const usersByPlatform = await this.userRepository.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } }
      ]);

      const verificationStats = await this.calculateVerificationStats();
      const subscriptionStats = await this.calculateSubscriptionStats();
      const loginStats = await this.calculateLoginStats();

      const statistics: UserStatistics = {
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        usersByRole: this.formatAggregationResult(usersByRole),
        usersByStatus: this.formatAggregationResult(usersByStatus),
        usersByPlatform: this.formatAggregationResult(usersByPlatform),
        usersByAuthProvider: await this.calculateAuthProviderStats(),
        verificationStats,
        subscriptionStats,
        loginStats
      };

      this.logger.debug('User statistics calculated', { totalUsers, activeUsers });

      return buildHiveResponse.success(statistics, 'User statistics retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to calculate user statistics', error);
      throw AuthErrorFactory.statisticsCalculationFailed('Failed to calculate statistics', error);
    }
  }

  async updateSubscription(userId: string, request: UpdateSubscriptionRequest): Promise<UserResponse> {
    try {
      this.logger.info('Updating user subscription', {
        userId,
        plan: request.plan,
        updatedBy: request.updatedBy
      });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const subscriptionData = {
        plan: request.plan,
        status: 'active' as const,
        startDate: request.startDate || new Date(),
        endDate: request.endDate,
        autoRenew: request.autoRenew || false,
        billingCycle: request.billingCycle || 'monthly'
      };

      await this.userRepository.updateSubscription(userId, subscriptionData);
      const updatedUser = await this.userRepository.findById(userId);

      if (updatedUser!.email) {
        await this.emailService.sendSubscriptionUpdateEmail(
          updatedUser!.email,
          updatedUser!.username,
          request.plan
        );
      }

      await this.publishUserEvent('user.subscription_updated', updatedUser!, {
        oldPlan: user.subscription?.plan,
        newPlan: request.plan,
        updatedBy: request.updatedBy
      });

      const userProfile = this.mapToUserProfile(updatedUser!);

      this.logger.info('User subscription updated successfully', {
        userId,
        plan: request.plan
      });

      return buildHiveResponse.success(userProfile, 'Subscription updated successfully');

    } catch (error) {
      this.logger.error('Failed to update subscription', error, { userId });
      throw AuthErrorFactory.subscriptionUpdateFailed('Failed to update subscription', error);
    }
  }

  async processCreditTransaction(request: CreditTransactionRequest): Promise<CreditBalance> {
    try {
      this.logger.info('Processing credit transaction', {
        userId: request.userId,
        amount: request.amount,
        type: request.type,
        processedBy: request.processedBy
      });

      const user = await this.userRepository.findById(request.userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(request.userId);
      }

      const transaction = {
        amount: request.amount,
        type: request.type,
        description: request.description,
        reference: request.reference,
        processedBy: request.processedBy,
        timestamp: new Date()
      };

      let newBalance = user.credits;

      switch (request.type) {
        case 'purchase':
        case 'bonus':
          newBalance += request.amount;
          break;
        case 'usage':
          if (newBalance < request.amount) {
            throw AuthErrorFactory.insufficientCredits();
          }
          newBalance -= request.amount;
          break;
        case 'refund':
          newBalance += request.amount;
          break;
      }

      await this.userRepository.updateCredits(request.userId, newBalance, transaction);
      const updatedUser = await this.userRepository.findById(request.userId);

      const creditBalance = await this.getCreditBalance(request.userId);

      if (updatedUser!.email) {
        await this.emailService.sendCreditTransactionEmail(
          updatedUser!.email,
          updatedUser!.username,
          transaction
        );
      }

      await this.publishUserEvent('user.credit_transaction', updatedUser!, {
        transaction,
        oldBalance: user.credits,
        newBalance
      });

      this.logger.info('Credit transaction processed successfully', {
        userId: request.userId,
        type: request.type,
        amount: request.amount,
        newBalance
      });

      return creditBalance;

    } catch (error) {
      this.logger.error('Failed to process credit transaction', error, {
        userId: request.userId,
        type: request.type,
        amount: request.amount
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.creditTransactionFailed('Failed to process credit transaction', error);
    }
  }

  async getCreditBalance(userId: string): Promise<CreditBalance> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const creditHistory = user.creditHistory || [];
      const totalPurchased = creditHistory
        .filter(t => t.type === 'purchase' || t.type === 'bonus')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalUsed = creditHistory
        .filter(t => t.type === 'usage')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalRefunded = creditHistory
        .filter(t => t.type === 'refund')
        .reduce((sum, t) => sum + t.amount, 0);

      const lastTransaction = creditHistory.length > 0 
        ? creditHistory[creditHistory.length - 1] 
        : undefined;

      return {
        userId,
        currentBalance: user.credits,
        totalPurchased,
        totalUsed,
        totalRefunded,
        lastTransaction
      };

    } catch (error) {
      this.logger.error('Failed to get credit balance', error, { userId });
      throw AuthErrorFactory.creditBalanceFailed('Failed to get credit balance', error);
    }
  }

  async bulkUpdateUsers(operation: BulkUserOperation): Promise<BulkOperationResult> {
    try {
      this.logger.info('Processing bulk user operation', {
        operation: operation.operation,
        userCount: operation.userIds.length,
        performedBy: operation.performedBy
      });

      const results: Array<{ userId: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const userId of operation.userIds) {
        try {
          await this.processBulkOperation(userId, operation);
          results.push({ userId, success: true });
          successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ userId, success: false, error: errorMessage });
          failed++;
          
          this.logger.warn('Bulk operation failed for user', error, { userId, operation: operation.operation });
        }
      }

      await this.publishUserEvent('users.bulk_updated', null, {
        operation: operation.operation,
        total: operation.userIds.length,
        successful,
        failed,
        performedBy: operation.performedBy
      });

      this.logger.info('Bulk user operation completed', {
        operation: operation.operation,
        total: operation.userIds.length,
        successful,
        failed
      });

      return {
        total: operation.userIds.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      this.logger.error('Failed to process bulk user operation', error, {
        operation: operation.operation,
        userCount: operation.userIds.length
      });

      throw AuthErrorFactory.bulkOperationFailed('Failed to process bulk operation', error);
    }
  }

  async deactivateUser(userId: string, reason?: string): Promise<UserResponse> {
    const request: UpdateUserStatusRequest = {
      status: USER_STATUS.INACTIVE,
      reason,
      updatedBy: 'system',
      notifyUser: true
    };

    return this.updateUserStatus(userId, request);
  }

  async reactivateUser(userId: string): Promise<UserResponse> {
    const request: UpdateUserStatusRequest = {
      status: USER_STATUS.ACTIVE,
      updatedBy: 'system',
      notifyUser: true
    };

    return this.updateUserStatus(userId, request);
  }

  async deleteUser(userId: string, hardDelete: boolean = false): Promise<boolean> {
    try {
      this.logger.info('Deleting user', { userId, hardDelete });

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      await this.sessionRepository.revokeAllUserSessions(userId);

      if (hardDelete) {
        await this.userRepository.hardDelete(userId);
        await this.profileRepository.deleteByUserId(userId);
      } else {
        await this.userRepository.softDelete(userId);
      }

      await this.publishUserEvent('user.deleted', user, {
        hardDelete,
        deletedBy: 'system'
      });

      this.logger.info('User deleted successfully', { userId, hardDelete });

      return true;

    } catch (error) {
      this.logger.error('Failed to delete user', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.userDeletionFailed('Failed to delete user', error);
    }
  }

  async checkEmailAvailability(email: string): Promise<{ available: boolean; message: string }> {
    try {
      const existingUser = await this.userRepository.findByEmail(email);
      
      if (existingUser) {
        return {
          available: false,
          message: 'Email address is already registered'
        };
      }

      return {
        available: true,
        message: 'Email address is available'
      };
    } catch (error) {
      this.logger.error('Failed to check email availability', error, { email });
      throw AuthErrorFactory.validationFailed('Failed to check email availability', error);
    }
  }

  async checkPhoneAvailability(phone: string): Promise<{ available: boolean; message: string }> {
    try {
      const existingUser = await this.userRepository.findByPhone(phone);
      
      if (existingUser) {
        return {
          available: false,
          message: 'Phone number is already registered'
        };
      }

      return {
        available: true,
        message: 'Phone number is available'
      };
    } catch (error) {
      this.logger.error('Failed to check phone availability', error, { phone });
      throw AuthErrorFactory.validationFailed('Failed to check phone availability', error);
    }
  }

  async getVerificationStatus(userId: string): Promise<{ email: boolean; phone: boolean; isFullyVerified: boolean }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      return {
        email: user.isEmailVerified,
        phone: user.isPhoneVerified,
        isFullyVerified: user.isEmailVerified && user.isPhoneVerified
      };
    } catch (error) {
      this.logger.error('Failed to get verification status', error, { userId });
      throw AuthErrorFactory.userNotFound(userId);
    }
  }

  private mapToUserProfile(user: IUserDocument): UserProfile {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      platform: user.platform,
      authProvider: user.authProvider,
      googleId: user.googleId,
      googleEmail: user.googleEmail,
      googleAvatar: user.googleAvatar,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      verificationStatus: user.verificationStatus,
      lastLogin: user.lastLogin,
      lastLoginIP: user.lastLoginIP,
      lastLoginPlatform: user.lastLoginPlatform,
      profileId: user.profileId?.toString(),
      registrationIP: user.registrationIP,
      marketingConsent: user.marketingConsent,
      loginAttempts: user.loginAttempts,
      isLocked: user.isLocked,
      lockUntil: user.lockUntil,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private async publishUserEvent(eventType: string, user: IUserDocument | null, metadata: any): Promise<void> {
    try {
      const event = {
        type: eventType,
        userId: user?.id,
        timestamp: new Date(),
        metadata
      };

      await this.eventPublisher.publish('user.events', event);
    } catch (error) {
      this.logger.warn('Failed to publish user event', error, { eventType });
    }
  }
}
