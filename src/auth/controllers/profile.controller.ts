import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services';
import { CreateProfileData, UpdateProfileData } from '../types';
import { sendSuccess, sendCreated, asyncErrorHandler } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export class ProfileController {
  private profileService: ProfileService;

  constructor() {
    this.profileService = new ProfileService();
  }

  createProfile = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const profileData: CreateProfileData = {
      userId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      avatar: req.body.avatar,
      preferences: req.body.preferences
    };

    const profile = await this.profileService.createProfile(profileData);

    return sendCreated(res, 'Profile created successfully', {
      profile: {
        id: profile.id,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        avatar: profile.avatar,
        preferences: profile.preferences,
        metadata: profile.metadata,
        createdAt: profile.createdAt
      }
    });
  });

  updateProfile = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const updateData: UpdateProfileData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      avatar: req.body.avatar,
      bio: req.body.bio,
      location: req.body.location,
      timezone: req.body.timezone
    };

    const profile = await this.profileService.updateProfile(userId, updateData);

    return sendSuccess(res, 'Profile updated successfully', {
      profile: {
        id: profile.id,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        avatar: profile.avatar,
        bio: profile.bio,
        location: profile.location,
        timezone: profile.timezone,
        preferences: profile.preferences,
        metadata: profile.metadata,
        updatedAt: profile.updatedAt
      }
    });
  });

  getProfile = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const profile = await this.profileService.getProfileByUserId(userId);
    if (!profile) {
      return sendSuccess(res, 'Profile not found', null, HTTP_STATUS_CODES.NOT_FOUND);
    }

    const completeness = await this.profileService.calculateProfileCompleteness(userId);
    const summary = this.profileService.getProfileSummary(profile);

    return sendSuccess(res, 'Profile retrieved successfully', {
      profile: {
        id: profile.id,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        avatar: profile.avatar,
        bio: profile.bio,
        location: profile.location,
        timezone: profile.timezone,
        preferences: profile.preferences,
        metadata: profile.metadata,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      },
      completeness,
      summary
    });
  });

  updatePreferences = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const preferences = req.body;
    const updatedProfile = await this.profileService.updatePreferences(userId, preferences);

    return sendSuccess(res, 'Preferences updated successfully', {
      preferences: updatedProfile.preferences
    });
  });

  getPreferences = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const preferences = await this.profileService.getPreferences(userId);

    return sendSuccess(res, 'Preferences retrieved successfully', {
      preferences
    });
  });

  getProfileCompleteness = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const completeness = await this.profileService.calculateProfileCompleteness(userId);
    const profile = await this.profileService.getProfileByUserId(userId);
    
    let tips: string[] = [];
    if (profile) {
      tips = this.profileService.getProfileCompletionTips(profile);
    }

    return sendSuccess(res, 'Profile completeness calculated', {
      completeness,
      tips,
      profileExists: profile !== null
    });
  });

  getProfileSummary = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const profile = await this.profileService.getProfileByUserId(userId);
    if (!profile) {
      return sendSuccess(res, 'Profile not found', null, HTTP_STATUS_CODES.NOT_FOUND);
    }

    const summary = this.profileService.getProfileSummary(profile);

    return sendSuccess(res, 'Profile summary retrieved successfully', {
      summary
    });
  });

  updateAvatar = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const { avatar } = req.body;
    const updatedProfile = await this.profileService.updateAvatar(userId, avatar);

    return sendSuccess(res, 'Avatar updated successfully', {
      avatar: updatedProfile.avatar
    });
  });

  deleteAvatar = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    await this.profileService.deleteAvatar(userId);

    return sendSuccess(res, 'Avatar deleted successfully');
  });

  updateRegistrationSource = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const source = req.body.source || 'web';
    await this.profileService.updateRegistrationSource(userId, source);

    return sendSuccess(res, 'Registration source updated successfully');
  });

  getMetadata = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const metadata = await this.profileService.getMetadata(userId);

    return sendSuccess(res, 'Profile metadata retrieved successfully', {
      metadata
    });
  });

  updateMetadata = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const metadata = req.body;
    const updatedProfile = await this.profileService.updateMetadata(userId, metadata);

    return sendSuccess(res, 'Profile metadata updated successfully', {
      metadata: updatedProfile.metadata
    });
  });

  deleteProfile = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    await this.profileService.deleteProfile(userId);

    return sendSuccess(res, 'Profile deleted successfully');
  });
}
