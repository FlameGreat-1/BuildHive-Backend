import { UserModel } from '../models';
import { User, CreateUserData, UserExistsCheck } from '../types';
import { AuthProvider } from '../../shared/types';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';

export class UserRepository {
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      return await UserModel.create(userData);
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.constraint?.includes('email')) {
          throw new AppError(
            'Email address is already registered',
            HTTP_STATUS_CODES.CONFLICT,
            ERROR_CODES.EMAIL_EXISTS
          );
        }
        if (error.constraint?.includes('username')) {
          throw new AppError(
            'Username is already taken',
            HTTP_STATUS_CODES.CONFLICT,
            ERROR_CODES.USERNAME_EXISTS
          );
        }
      }
      throw new AppError(
        'Failed to create user account',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      return await UserModel.findByEmail(email);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user by email',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findUserByUsername(username: string): Promise<User | null> {
    try {
      return await UserModel.findByUsername(username);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user by username',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findUserBySocialId(socialId: string, provider: AuthProvider): Promise<User | null> {
    try {
      return await UserModel.findBySocialId(socialId, provider);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user by social ID',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async checkUserExists(email: string, username: string, socialId?: string): Promise<UserExistsCheck> {
    try {
      return await UserModel.checkExists(email, username, socialId);
    } catch (error) {
      throw new AppError(
        'Failed to check user existence',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    try {
      await UserModel.updateEmailVerificationToken(userId, token, expires);
    } catch (error) {
      throw new AppError(
        'Failed to update email verification token',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async verifyUserEmail(userId: string): Promise<void> {
    try {
      await UserModel.verifyEmail(userId);
    } catch (error) {
      throw new AppError(
        'Failed to verify user email',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findUserById(id: string): Promise<User | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user by ID',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    try {
      const user = await UserModel.findByEmail(email);
      return user === null;
    } catch (error) {
      throw new AppError(
        'Failed to check email availability',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const user = await UserModel.findByUsername(username);
      return user === null;
    } catch (error) {
      throw new AppError(
        'Failed to check username availability',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findUserByPasswordResetToken(token: string): Promise<User | null> {
    try {
      return await UserModel.findByPasswordResetToken(token);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user by password reset token',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updatePasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    try {
      await UserModel.updatePasswordResetToken(userId, token, expires);
    } catch (error) {
      throw new AppError(
        'Failed to update password reset token',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    try {
      await UserModel.clearPasswordResetToken(userId);
    } catch (error) {
      throw new AppError(
        'Failed to clear password reset token',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    try {
      await UserModel.updatePassword(userId, passwordHash);
    } catch (error) {
      throw new AppError(
        'Failed to update password',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async incrementLoginAttempts(userId: string): Promise<void> {
    try {
      await UserModel.incrementLoginAttempts(userId);
    } catch (error) {
      throw new AppError(
        'Failed to increment login attempts',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    try {
      await UserModel.resetLoginAttempts(userId);
    } catch (error) {
      throw new AppError(
        'Failed to reset login attempts',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    try {
      await UserModel.lockAccount(userId, lockUntil);
    } catch (error) {
      throw new AppError(
        'Failed to lock account',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await UserModel.updateLastLogin(userId);
    } catch (error) {
      throw new AppError(
        'Failed to update last login',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }
}
