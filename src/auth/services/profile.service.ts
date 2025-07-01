import { ProfileRepository } from '../repositories';
import { Profile, CreateProfileData } from '../types';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';

export class ProfileService {
  private profileRepository: ProfileRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
  }

  async createProfile(profileData: CreateProfileData): Promise<Profile> {
    const existingProfile = await this.profileRepository.findProfileByUserId(profileData.userId);
    if (existingProfile) {
      throw new AppError(
        'Profile already exists for this user',
        HTTP_STATUS_CODES.CONFLICT,
        ERROR_CODES.USER_EXISTS
      );
    }

    const profile = await this.profileRepository.createProfile(profileData);
    await this.profileRepository.updateProfileCompleteness(profileData.userId);
    
    return profile;
  }

  async getProfileByUserId(userId: string): Promise<Profile | null> {
    return await this.profileRepository.findProfileByUserId(userId);
  }

  async updateRegistrationSource(userId: string, source: string): Promise<void> {
    const profileExists = await this.profileRepository.profileExists(userId);
    if (!profileExists) {
      throw new AppError(
        'Profile not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    await this.profileRepository.updateRegistrationMetadata(userId, source);
  }

  async calculateProfileCompleteness(userId: string): Promise<number> {
    const profileExists = await this.profileRepository.profileExists(userId);
    if (!profileExists) {
      return 0;
    }

    return await this.profileRepository.calculateProfileCompleteness(userId);
  }

  async updateProfileCompleteness(userId: string): Promise<void> {
    const profileExists = await this.profileRepository.profileExists(userId);
    if (!profileExists) {
      throw new AppError(
        'Profile not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    await this.profileRepository.updateProfileCompleteness(userId);
  }

  async profileExists(userId: string): Promise<boolean> {
    return await this.profileRepository.profileExists(userId);
  }

  getProfileCompletionTips(profile: Profile): string[] {
    const tips: string[] = [];

    if (!profile.firstName) {
      tips.push('Add your first name to personalize your profile');
    }

    if (!profile.lastName) {
      tips.push('Add your last name to complete your identity');
    }

    if (!profile.phone) {
      tips.push('Add your phone number for better communication');
    }

    if (!profile.avatar) {
      tips.push('Upload a profile picture to build trust');
    }

    if (!profile.bio) {
      tips.push('Write a brief bio to introduce yourself');
    }

    if (!profile.location) {
      tips.push('Add your location to find nearby opportunities');
    }

    return tips.slice(0, 3);
  }

  getProfileSummary(profile: Profile): {
    completeness: number;
    missingFields: string[];
    tips: string[];
  } {
    const missingFields: string[] = [];
    
    if (!profile.firstName) missingFields.push('firstName');
    if (!profile.lastName) missingFields.push('lastName');
    if (!profile.phone) missingFields.push('phone');
    if (!profile.avatar) missingFields.push('avatar');
    if (!profile.bio) missingFields.push('bio');
    if (!profile.location) missingFields.push('location');

    return {
      completeness: profile.metadata.profileCompleteness,
      missingFields,
      tips: this.getProfileCompletionTips(profile)
    };
  }
}
