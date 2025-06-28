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

interface UserWithProfile extends UserEntity {
  clientProfile?: ClientProfile;
  tradieProfile?: TradieProfile;
  enterpriseProfile?: EnterpriseProfile;
  documents?: DocumentUpload[];
}

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: UserType;
  metadata?: Record<string, any>;
}

interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  metadata?: Record<string, any>;
  lastLoginAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

interface UserSearchFilters {
  userType?: UserType;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export class UserModel {
  private prisma: PrismaClient;
  private static instance: UserModel;

  private constructor() {
    this.prisma = getDatabase();
  }

  public static getInstance(): UserModel {
    if (!UserModel.instance) {
      UserModel.instance = new UserModel();
    }
    return UserModel.instance;
  }

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

      const validation = await this.validateUserData(userData);
      if (!validation.isValid) {
        throw new Error(`User validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      await this.checkUserExists(userData.email, userData.phone);

      const passwordHash = await hashPassword(userData.password);

      const emailVerificationToken = this.generateVerificationToken();
      const phoneVerificationCode = this.generateVerificationCode();

      const user = await executeTransaction(async (prisma) => {
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

        await this.createUserProfile(prisma, newUser.id, userData.userType);

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
          timestamp: new Date(),
        });

        return newUser;
      });

      await this.cacheUser(user as UserEntity);

      const duration = Date.now() - startTime;
      logger.info('User created successfully', {
        ...logContext,
        userId: user.id,
        duration,
        profileCompleteness: user.profileCompleteness,
      });

      logger.performance('user_creation', duration, logContext);

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

  public async getUserById(userId: string, includeProfile: boolean = false): Promise<UserWithProfile | null> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ includeProfile })
      .build();

    try {
      const cacheKey = `user:${userId}${includeProfile ? ':with_profile' : ''}`;
      const cachedUser = await getCache<UserWithProfile>(cacheKey);
      
      if (cachedUser) {
        logger.debug('User retrieved from cache', {
          ...logContext,
          cacheHit: true,
        });
        return cachedUser;
      }

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

      await setCache(cacheKey, user, { ttl: 300 });

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

  public async getUserByEmail(email: string, includeProfile: boolean = false): Promise<UserWithProfile | null> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();
    const logContext = createLogContext()
      .withMetadata({ email: normalizedEmail, includeProfile })
      .build();

    try {
      const cacheKey = `user:email:${normalizedEmail}${includeProfile ? ':with_profile' : ''}`;
      const cachedUser = await getCache<UserWithProfile>(cacheKey);
      
      if (cachedUser) {
        logger.debug('User retrieved from cache by email', {
          ...logContext,
          cacheHit: true,
        });
        return cachedUser;
      }

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

      await setCache(cacheKey, user, { ttl: 300 });

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

  public async updateUser(userId: string, updateData: UpdateUserData, updatedBy?: string): Promise<UserEntity> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ updatedBy, updateFields: Object.keys(updateData) })
      .build();

    try {
      logger.info('Updating user', logContext);

      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      const validation = await this.validateUpdateData(updateData);
      if (!validation.isValid) {
        throw new Error(`Update validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      const updatedUser = await executeTransaction(async (prisma) => {
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            ...updateData,
            updatedBy,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.createAuditLog(prisma, {
          userId: updatedBy || userId,
          action: AUDIT_CONSTANTS.ACTIONS.UPDATE,
          resource: AUDIT_CONSTANTS.RESOURCES.USER,
          resourceId: userId,
          oldValues: this.extractAuditableFields(currentUser),
          newValues: this.extractAuditableFields(updateData),
          ipAddress: logContext.ipAddress || 'system',
          userAgent: logContext.userAgent || 'system',
          severity: AuditSeverity.INFO,
          timestamp: new Date(),
        });

        return user;
      });

      await this.invalidateUserCache(userId);

      const duration = Date.now() - startTime;
      logger.info('User updated successfully', {
        ...logContext,
        duration,
        version: updatedUser.version,
      });

      logger.performance('user_update', duration, logContext);

      return updatedUser as UserEntity;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User update failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });
      throw error;
    }
  }

  public async verifyEmail(userId: string, token: string): Promise<boolean> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ verificationType: 'email' })
      .build();

    try {
      logger.info('Verifying user email', logContext);

      const result = await executeTransaction(async (prisma) => {
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            emailVerificationToken: token,
            isDeleted: false,
          },
        });

        if (!user) {
          return false;
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            emailVerified: true,
            emailVerificationToken: null,
            status: user.phoneVerified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.createAuditLog(prisma, {
          userId,
          action: AUDIT_CONSTANTS.ACTIONS.UPDATE,
          resource: AUDIT_CONSTANTS.RESOURCES.USER,
          resourceId: userId,
          newValues: { emailVerified: true },
          ipAddress: logContext.ipAddress || 'system',
          userAgent: logContext.userAgent || 'system',
          severity: AuditSeverity.INFO,
          timestamp: new Date(),
        });

        return true;
      });

      if (result) {
        await this.invalidateUserCache(userId);

        const duration = Date.now() - startTime;
        logger.info('Email verified successfully', {
          ...logContext,
          duration,
        });

        logger.business('USER_EMAIL_VERIFIED', logContext);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.BIZ_VERIFICATION_CODE_INVALID,
      });
      throw error;
    }
  }

  public async verifyPhone(userId: string, code: string): Promise<boolean> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ verificationType: 'phone' })
      .build();

    try {
      logger.info('Verifying user phone', logContext);

      const result = await executeTransaction(async (prisma) => {
        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            phoneVerificationCode: code,
            isDeleted: false,
          },
        });

        if (!user) {
          return false;
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            phoneVerified: true,
            phoneVerificationCode: null,
            status: user.emailVerified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.createAuditLog(prisma, {
          userId,
          action: AUDIT_CONSTANTS.ACTIONS.UPDATE,
          resource: AUDIT_CONSTANTS.RESOURCES.USER,
          resourceId: userId,
          newValues: { phoneVerified: true },
          ipAddress: logContext.ipAddress || 'system',
          userAgent: logContext.userAgent || 'system',
          severity: AuditSeverity.INFO,
          timestamp: new Date(),
        });

        return true;
      });

      if (result) {
        await this.invalidateUserCache(userId);

        const duration = Date.now() - startTime;
        logger.info('Phone verified successfully', {
          ...logContext,
          duration,
        });

        logger.business('USER_PHONE_VERIFIED', logContext);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Phone verification failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.BIZ_VERIFICATION_CODE_INVALID,
      });
      throw error;
    }
  }

  public async searchUsers(filters: UserSearchFilters, page: number = 1, limit: number = 20): Promise<{
    users: UserEntity[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ filters, page, limit })
      .build();

    try {
      logger.debug('Searching users', logContext);

      const where: any = {
        isDeleted: false,
      };

      if (filters.userType) where.userType = filters.userType;
      if (filters.status) where.status = filters.status;
      if (filters.emailVerified !== undefined) where.emailVerified = filters.emailVerified;
      if (filters.phoneVerified !== undefined) where.phoneVerified = filters.phoneVerified;
      if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
      if (filters.createdBefore) {
        where.createdAt = where.createdAt ? 
          { ...where.createdAt, lte: filters.createdBefore } : 
          { lte: filters.createdBefore };
      }
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const total = await this.prisma.user.count({ where });

      const users = await this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const duration = Date.now() - startTime;
      logger.debug('User search completed', {
        ...logContext,
        duration,
        resultCount: users.length,
        total,
      });

      return {
        users: users as UserEntity[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User search failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });
      throw error;
    }
  }

  public async deleteUser(userId: string, deletedBy?: string): Promise<boolean> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(userId)
      .withMetadata({ deletedBy })
      .build();

    try {
      logger.info('Soft deleting user', logContext);

      const result = await executeTransaction(async (prisma) => {
        const user = await prisma.user.findFirst({
          where: { id: userId, isDeleted: false },
        });

        if (!user) {
          return false;
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy,
            updatedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.createAuditLog(prisma, {
          userId: deletedBy || userId,
          action: AUDIT_CONSTANTS.ACTIONS.DELETE,
          resource: AUDIT_CONSTANTS.RESOURCES.USER,
          resourceId: userId,
          oldValues: { isDeleted: false },
          newValues: { isDeleted: true },
          ipAddress: logContext.ipAddress || 'system',
          userAgent: logContext.userAgent || 'system',
          severity: AuditSeverity.INFO,
          timestamp: new Date(),
        });

        return true;
      });

      if (result) {
        await this.invalidateUserCache(userId);

        const duration = Date.now() - startTime;
        logger.info('User soft deleted successfully', {
          ...logContext,
          duration,
        });

        logger.audit('USER_DELETED', 'USER', logContext);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('User deletion failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });
      throw error;
    }
  }
  
  private async validateUserData(userData: CreateUserData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!userData.email || !VALIDATION_CONSTANTS.EMAIL.REGEX.test(userData.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: ERROR_CODES.VAL_INVALID_EMAIL,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (userData.email && userData.email.length > VALIDATION_CONSTANTS.EMAIL.MAX_LENGTH) {
      errors.push({
        field: 'email',
        message: `Email must not exceed ${VALIDATION_CONSTANTS.EMAIL.MAX_LENGTH} characters`,
        code: ERROR_CODES.VAL_INVALID_EMAIL,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!userData.firstName || userData.firstName.length < VALIDATION_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push({
        field: 'firstName',
        message: `First name must be at least ${VALIDATION_CONSTANTS.NAME.MIN_LENGTH} characters`,
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!userData.lastName || userData.lastName.length < VALIDATION_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push({
        field: 'lastName',
        message: `Last name must be at least ${VALIDATION_CONSTANTS.NAME.MIN_LENGTH} characters`,
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!userData.phone || !VALIDATION_CONSTANTS.PHONE.REGEX.test(userData.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        code: ERROR_CODES.VAL_INVALID_PHONE,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (!Object.values(UserType).includes(userData.userType)) {
      errors.push({
        field: 'userType',
        message: 'Invalid user type',
        code: ERROR_CODES.VAL_INVALID_USER_TYPE,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validateUpdateData(updateData: UpdateUserData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (updateData.firstName && updateData.firstName.length < VALIDATION_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push({
        field: 'firstName',
        message: `First name must be at least ${VALIDATION_CONSTANTS.NAME.MIN_LENGTH} characters`,
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (updateData.lastName && updateData.lastName.length < VALIDATION_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push({
        field: 'lastName',
        message: `Last name must be at least ${VALIDATION_CONSTANTS.NAME.MIN_LENGTH} characters`,
        code: ERROR_CODES.VAL_REQUIRED_FIELD,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (updateData.phone && !VALIDATION_CONSTANTS.PHONE.REGEX.test(updateData.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        code: ERROR_CODES.VAL_INVALID_PHONE,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    if (updateData.status && !Object.values(UserStatus).includes(updateData.status)) {
      errors.push({
        field: 'status',
        message: 'Invalid user status',
        code: ERROR_CODES.VAL_INVALID_ENUM_VALUE,
        severity: ErrorSeverity.ERROR,
        statusCode: 400,
        name: 'ValidationError',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async checkUserExists(email: string, phone: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: phone },
        ],
        isDeleted: false,
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new Error('Email already exists');
      }
      if (existingUser.phone === phone) {
        throw new Error('Phone number already exists');
      }
    }
  }

  private async createUserProfile(prisma: PrismaClient, userId: string, userType: UserType): Promise<void> {
    switch (userType) {
      case UserType.CLIENT:
        await prisma.clientProfile.create({
          data: {
            userId,
            companyName: '',
            verificationStatus: VerificationStatus.PENDING,
            isVerified: false,
          },
        });
        break;

      case UserType.TRADIE:
        await prisma.tradieProfile.create({
          data: {
            userId,
            businessName: '',
            serviceRadius: 0,
            verificationStatus: VerificationStatus.PENDING,
            isVerified: false,
            rating: 0,
            completedJobs: 0,
          },
        });
        break;

      case UserType.ENTERPRISE:
        await prisma.enterpriseProfile.create({
          data: {
            userId,
            companyName: '',
            verificationStatus: VerificationStatus.PENDING,
            isVerified: false,
            subscriptionTier: 'BASIC',
            maxTeamMembers: 5,
          },
        });
        break;
    }
  }

  private async createAuditLog(prisma: PrismaClient, auditData: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    await prisma.auditLog.create({
      data: {
        ...auditData,
        createdAt: new Date(),
      },
    });
  }

  private async cacheUser(user: UserEntity): Promise<void> {
    const cachePromises = [
      setCache(`user:${user.id}`, user, { ttl: 300 }),
      setCache(`user:email:${user.email}`, user, { ttl: 300 }),
    ];

    await Promise.all(cachePromises);
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      const cacheKeys = [
        `user:${userId}`,
        `user:${userId}:with_profile`,
        `user:email:${user.email}`,
        `user:email:${user.email}:with_profile`,
      ];

      await Promise.all(cacheKeys.map(key => deleteCache(key)));
    }
  }

  private calculateInitialCompleteness(userType: UserType): number {
    return 25;
  }

  private extractAuditableFields(data: any): Record<string, any> {
    const auditableFields = ['firstName', 'lastName', 'phone', 'status', 'emailVerified', 'phoneVerified'];
    const result: Record<string, any> = {};

    auditableFields.forEach(field => {
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    });

    return result;
  }

  private generateVerificationToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const userModel = UserModel.getInstance();

export const createUser = async (userData: CreateUserData, createdBy?: string): Promise<UserEntity> => {
  return await userModel.createUser(userData, createdBy);
};

export const getUserById = async (userId: string, includeProfile: boolean = false): Promise<UserWithProfile | null> => {
  return await userModel.getUserById(userId, includeProfile);
};

export const getUserByEmail = async (email: string, includeProfile: boolean = false): Promise<UserWithProfile | null> => {
  return await userModel.getUserByEmail(email, includeProfile);
};

export const updateUser = async (userId: string, updateData: UpdateUserData, updatedBy?: string): Promise<UserEntity> => {
  return await userModel.updateUser(userId, updateData, updatedBy);
};

export const verifyUserEmail = async (userId: string, token: string): Promise<boolean> => {
  return await userModel.verifyEmail(userId, token);
};

export const verifyUserPhone = async (userId: string, code: string): Promise<boolean> => {
  return await userModel.verifyPhone(userId, code);
};

export const searchUsers = async (filters: UserSearchFilters, page?: number, limit?: number) => {
  return await userModel.searchUsers(filters, page, limit);
};

export const deleteUser = async (userId: string, deletedBy?: string): Promise<boolean> => {
  return await userModel.deleteUser(userId, deletedBy);
};

export { UserEntity, UserWithProfile, CreateUserData, UpdateUserData, UserSearchFilters };
