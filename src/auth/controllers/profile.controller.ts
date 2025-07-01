import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services';
import { CreateProfileData } from '../types';
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

  updateRegistrationSource = asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const source = req.body.source || 'web';
    await this.profileService.updateRegistrationSource(userId, source);

    return sendSuccess(res, 'Registration source updated successfully');
  });
}
