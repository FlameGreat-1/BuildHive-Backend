import bcrypt from 'bcrypt';
import { UserRepository, ProfileRepository } from '../repositories';
import { User, CreateUserData, UserPublicData, UserRegistrationData } from '../types';
import { UserRole, AuthProvider } from '../../shared/types';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
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
}
