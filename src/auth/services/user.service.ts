import bcrypt from 'bcrypt';
import { UserRepository, ProfileRepository } from '../repositories';
import { User, CreateUserData, UserPublicData, UserRegistrationData } from '../types';
import { UserRole, AuthProvider, UserStatus } from '../../shared/types';
import { HTTP_STATUS_CODES, ERROR_CODES, AUTH_CONSTANTS } from '../../config/auth';
import { ConflictError, AppError } from '../../shared/utils';

export class UserService {
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
  }

  async registerUser(registrationData: UserRegistrationData): Promise<User> {
    const existsCheck = await this.userRepository.checkUserExists(
      registrationData.email,
      registrationData.username,
      registrationData.socialId
    );

    if (existsCheck.email) {
      throw new ConflictError('Email address is already registered', ERROR_CODES.EMAIL_EXISTS);
    }

    if (existsCheck.username) {
      throw new ConflictError('Username is already taken', ERROR_CODES.USERNAME_EXISTS);
    }

    if (registrationData.socialId && existsCheck.socialId) {
      throw new ConflictError('Social account is already linked to another user', ERROR_CODES.USER_EXISTS);
    }

    const createUserData: CreateUserData = {
      username: registrationData.username,
      email: registrationData.email,
      role: registrationData.role,
      authProvider: registrationData.authProvider,
      socialId: registrationData.socialId,
      socialData: registrationData.socialData
    };

    if (registrationData.password && registrationData.authProvider === AuthProvider.LOCAL) {
      createUserData.password = await bcrypt.hash(registrationData.password, 12);
    }

    const user = await this.userRepository.createUser(createUserData);

    await this.profileRepository.createProfile({
      userId: user.id,
      firstName: registrationData.socialData?.name?.split(' ')[0],
      lastName: registrationData.socialData?.name?.split(' ').slice(1).join(' '),
      avatar: registrationData.socialData?.picture
    });

    await this.profileRepository.updateRegistrationMetadata(
      user.id,
      registrationData.authProvider === AuthProvider.LOCAL ? 'web' : registrationData.authProvider
    );

    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError(
        'Invalid email or password',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError(
        'Account has been suspended',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        'Account is temporarily locked due to too many failed login attempts',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    if (!user.emailVerified && user.authProvider === AuthProvider.LOCAL) {
      throw new AppError(
        'Please verify your email address before logging in',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED
      );
    }

    if (!user.passwordHash || user.authProvider !== AuthProvider.LOCAL) {
      throw new AppError(
        'Invalid login method for this account',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new AppError(
        'Invalid email or password',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    await this.handleSuccessfulLogin(user.id);
    return user;
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashedPassword);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (!user.passwordHash || user.authProvider !== AuthProvider.LOCAL) {
      throw new AppError(
        'Password change not available for social accounts',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new AppError(
        'Current password is incorrect',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AppError(
        'New password must be different from current password',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.SAME_PASSWORD
      );
    }

    await this.updatePassword(userId, newPassword);
  }

  async initiatePasswordReset(email: string): Promise<User> {
    const user = await this.userRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError(
        'No account found with this email address',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new AppError(
        'Password reset not available for social accounts',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    return user;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findUserByPasswordResetToken(token);
    if (!user) {
      throw new AppError(
        'Invalid or expired password reset token',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN
      );
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw new AppError(
        'Password reset token has expired',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.PASSWORD_RESET_EXPIRED
      );
    }

    await this.updatePassword(user.id, newPassword);
    await this.userRepository.clearPasswordResetToken(user.id);
  }

  async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) return;

    await this.userRepository.incrementLoginAttempts(userId);

    const newAttempts = (user.loginAttempts || 0) + 1;
    if (newAttempts >= AUTH_CONSTANTS.LOGIN_ATTEMPTS.MAX_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + AUTH_CONSTANTS.LOGIN_ATTEMPTS.LOCKOUT_DURATION_MINUTES);
      await this.userRepository.lockAccount(userId, lockUntil);
    }
  }

  async handleSuccessfulLogin(userId: string): Promise<void> {
    await this.userRepository.resetLoginAttempts(userId);
    await this.userRepository.updateLastLogin(userId);
    await this.profileRepository.updateLoginCount(userId);
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findUserById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findUserByEmail(email);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findUserByUsername(username);
  }

  async getUserBySocialId(socialId: string, provider: AuthProvider): Promise<User | null> {
    return await this.userRepository.findUserBySocialId(socialId, provider);
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    return await this.userRepository.isEmailAvailable(email);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    return await this.userRepository.isUsernameAvailable(username);
  }

  async verifyUserEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    await this.userRepository.verifyUserEmail(userId);
    await this.profileRepository.updateProfileCompleteness(userId);
  }

  getUserPublicData(user: User): UserPublicData {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };
  }

  async generateUniqueUsername(baseName: string): Promise<string> {
    let username = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let counter = 0;

    while (!(await this.isUsernameAvailable(username))) {
      counter++;
      username = `${baseName}${counter}`;
    }

    return username;
  }

  async updateLoginAttempts(userId: string, increment: boolean = true): Promise<void> {
    if (increment) {
      await this.userRepository.incrementLoginAttempts(userId);
    } else {
      await this.userRepository.resetLoginAttempts(userId);
    }
  }
  
    async findById(id: string): Promise<User | null> {
    return await this.getUserById(id);
  }
}

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.updateLastLogin(userId);
  }

  async isAccountLocked(user: User): Promise<boolean> {
    if (!user.lockedUntil) return false;
    return user.lockedUntil > new Date();
  }

  async canAttemptLogin(user: User): Promise<boolean> {
    if (user.status === UserStatus.SUSPENDED) return false;
    if (await this.isAccountLocked(user)) return false;
    if (!user.emailVerified && user.authProvider === AuthProvider.LOCAL) return false;
    return true;
  }
}
