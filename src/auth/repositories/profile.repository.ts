import { ProfileModel } from '../models';
import { Profile, CreateProfileData, UpdateProfileData, ProfilePreferences, ProfileMetadata } from '../types';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';

export class ProfileRepository {
  async createProfile(profileData: CreateProfileData): Promise<Profile> {
    try {
      return await ProfileModel.create(profileData);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new AppError(
          'Profile already exists for this user',
          HTTP_STATUS_CODES.CONFLICT,
          ERROR_CODES.USER_EXISTS
        );
      }
      throw new AppError(
        'Failed to create user profile',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateProfile(userId: string, updateData: UpdateProfileData): Promise<Profile> {
    try {
      return await ProfileModel.updateProfile(userId, updateData);
    } catch (error) {
      throw new AppError(
        'Failed to update user profile',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findProfileByUserId(userId: string): Promise<Profile | null> {
    try {
      return await ProfileModel.findByUserId(userId);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user profile',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updatePreferences(userId: string, preferences: Partial<ProfilePreferences>): Promise<Profile> {
    try {
      return await ProfileModel.updatePreferences(userId, preferences);
    } catch (error) {
      throw new AppError(
        'Failed to update user preferences',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateAvatar(userId: string, avatar: string | null): Promise<Profile> {
    try {
      return await ProfileModel.updateAvatar(userId, avatar);
    } catch (error) {
      throw new AppError(
        'Failed to update user avatar',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateMetadata(userId: string, metadata: Partial<ProfileMetadata>): Promise<Profile> {
    try {
      return await ProfileModel.updateMetadata(userId, metadata);
    } catch (error) {
      throw new AppError(
        'Failed to update profile metadata',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async deleteProfile(userId: string): Promise<void> {
    try {
      await ProfileModel.deleteProfile(userId);
    } catch (error) {
      throw new AppError(
        'Failed to delete user profile',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateLoginCount(userId: string): Promise<void> {
    try {
      await ProfileModel.updateLoginCount(userId);
    } catch (error) {
      throw new AppError(
        'Failed to update login count',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateRegistrationMetadata(userId: string, source: string): Promise<void> {
    try {
      await ProfileModel.updateRegistrationMetadata(userId, source);
    } catch (error) {
      throw new AppError(
        'Failed to update registration metadata',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async calculateProfileCompleteness(userId: string): Promise<number> {
    try {
      return await ProfileModel.calculateCompleteness(userId);
    } catch (error) {
      throw new AppError(
        'Failed to calculate profile completeness',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateProfileCompleteness(userId: string): Promise<void> {
    try {
      await ProfileModel.updateCompleteness(userId);
    } catch (error) {
      throw new AppError(
        'Failed to update profile completeness',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async profileExists(userId: string): Promise<boolean> {
    try {
      const profile = await ProfileModel.findByUserId(userId);
      return profile !== null;
    } catch (error) {
      throw new AppError(
        'Failed to check profile existence',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }
}
