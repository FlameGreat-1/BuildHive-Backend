import { ProfileModel } from '../models';
import { Profile, CreateProfileData } from '../types';
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
