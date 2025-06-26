// src/models/User.ts

import { PrismaClient } from '@prisma/client';
import { getDatabase, executeTransaction } from '@/config/database';
import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES, AUDIT_CONSTANTS, VALIDATION_CONSTANTS } from '@/utils/constants';
import { setCache, getCache, deleteCache } from '@/config/redis';
import { hashPassword } from '@/config/auth';
import { 
  UserType, 
  UserStatus, 
  VerificationStatus, 
  DocumentType,
  BaseUser,
  RegisterRequest,
  ClientProfile,
  TradieProfile,
  EnterpriseProfile,
  DocumentUpload
} from '@/types/auth.types';
import { 
  BaseEntity, 
  ApiError, 
  ErrorSeverity, 
  ValidationResult, 
  ValidationError,
  AuditLog,
  AuditSeverity
} from '@/types/common.types';

// Enterprise User entity interface
interface UserEntity extends BaseEntity {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: UserType;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerificationToken?: string;
  phoneVerificationCode?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  loginCount: number;
  profileCompleteness: number;
  metadata?: Record<string, any>;
}

// Enterprise User profile interfaces
interface UserWithProfile extends UserEntity {
  clientProfile?: ClientProfile;
  tradieProfile?: TradieProfile;
  enterpriseProfile?: EnterpriseProfile;
  documents?: DocumentUpload[];
}

// Enterprise User creation data
interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: UserType;
  metadata?: Record<string, any>;
}

// Enterprise User update data
interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  metadata?: Record<string, any>;
}

// Enterprise User search filters
interface UserSearchFilters {
  userType?: UserType;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

// Enterprise User model class
export class UserModel {
  private prisma: PrismaClient;
  private static instance: UserModel;

  private constructor() {
    this.prisma = getDatabase();
  }

  // Singleton pattern for enterprise user model
  public static getInstance(): UserModel {
    if (!UserModel.instance) {
      UserModel.instance = new UserModel();
    }
    return UserModel.instance;
  }

  // Enterprise user creation with comprehensive validation
  public async createUser(userData: CreateUserData, createdBy?: string): Promise<UserEntity> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ 
        userType: userData.userType,
        email: userData.email,
        createdBy 
      })
      .build();

    try {
      logger.info('Creating new user', logContext);

      // Validate user data
      const validation = await this.validateUserData(userData);
      if (!validation.isValid) {
        throw new Error(`User validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Check for existing user
      await this.checkUserExists(userData.email, userData.phone);

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Generate verification tokens
      const emailVerificationToken = this.generateVerificationToken();
      const phoneVerificationCode = this.generateVerificationCode();

      // Create user in transaction
      const user = await executeTransaction(async (prisma) => {
        // Create base user
        const newUser = await prisma.user.create({
          data: {
            email: userData.email.toLowerCase(),
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            userType: userData.userType,
            status: UserStatus.PENDING_VERIFICATION,
            emailVerified: false,
            phoneVerified: false,
            emailVerificationToken,
            phoneVerificationCode,
            loginCount: 0,
            profileCompleteness: this.calculateInitialCompleteness(userData.userType),
            metadata: userData.metadata || {},
            createdBy,
            version: 1,
            isDeleted: false,
          },
        });

        // Create user-specific profile
        await this.createUserProfile(prisma, newUser.id, userData.userType);

        // Create audit log
        await this.createAuditLog(prisma, {
          userId: newUser.id,
          action: AUDIT_CONSTANTS.ACTIONS.CREATE,
          resource: AUDIT_CONSTANTS.RESOURCES.USER,
          resourceId: newUser.id,
          newValues: {
            email: newUser.email,
            userType: newUser.userType,
            status: newUser.status,
          },
          ipAddress: logContext.ipAddress || 'system',
          userAgent: 'system',
          severity: AuditSeverity.INFO,
        });

        return newUser;
      });

      // Cache user data
      await this.cacheUser(user);

      const duration = Date.now() - startTime;
      logger.info('User created successfully', {
        ...logContext,
        userId: user.id,
        duration,
        profileCompleteness: user.profileCompleteness,
      });

      logger.performance('user_creation', duration, logContext);

      // Log business event
      logger.business('USER_REGISTERED', {
        ...logContext,
        userId: user.id,
        userType: user.userType,
      });

      return user as UserEntity;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User creation failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.BIZ_EMAIL_ALREADY_EXISTS,
      });
      throw error;
    }
  }

  // Enterprise user retrieval with caching
  public async getUserById(userId: string, includeProfile: boolean = false): Promise<UserWithProfile | null> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ includeProfile })
      .build();

    try {
      // Try cache first
      const cacheKey = `user:${userId}${includeProfile ? ':with_profile' : ''}`;
      const cachedUser = await getCache<UserWithProfile>(cacheKey);
      
      if (cachedUser) {
        logger.debug('User retrieved from cache', {
          ...logContext,
          cacheHit: true,
        });
        return cachedUser;
      }

      // Query database
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          isDeleted: false,
        },
        include: includeProfile ? {
          clientProfile: true,
          tradieProfile: true,
          enterpriseProfile: true,
          documents: true,
        } : undefined,
      });

      if (!user) {
        logger.warn('User not found', {
          ...logContext,
          errorCode: ERROR_CODES.BIZ_RESOURCE_NOT_FOUND,
        });
        return null;
      }

      // Cache the result
      await setCache(cacheKey, user, { ttl: 300 }); // 5 minutes

      const duration = Date.now() - startTime;
      logger.debug('User retrieved from database', {
        ...logContext,
        duration,
        cacheHit: false,
      });

      return user as UserWithProfile;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User retrieval failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });
      throw error;
    }
  }

  // Enterprise user retrieval by email
  public async getUserByEmail(email: string, includeProfile: boolean = false): Promise<UserWithProfile | null> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();
    const logContext = createLogContext()
      .withMetadata({ email: normalizedEmail, includeProfile })
      .build();

    try {
      // Try cache first
      const cacheKey = `user:email:${normalizedEmail}${includeProfile ? ':with_profile' : ''}`;
      const cachedUser = await getCache<UserWithProfile>(cacheKey);
      
      if (cachedUser) {
        logger.debug('User retrieved from cache by email', {
          ...logContext,
          cacheHit: true,
        });
        return cachedUser;
      }

      // Query database
      const user = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          isDeleted: false,
        },
        include: includeProfile ? {
          clientProfile: true,
          tradieProfile: true,
          enterpriseProfile: true,
          documents: true,
        } : undefined,
      });

      if (!user) {
        return null;
      }

      // Cache the result
      await setCache(cacheKey, user, { ttl: 300 }); // 5 minutes

      const duration = Date.now() - startTime;
      logger.debug('User retrieved from database by email', {
        ...logContext,
        userId: user.id,
        duration,
        cacheHit: false,
      });

      return user as UserWithProfile;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User retrieval by email failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });
      throw error;
    }
  }
