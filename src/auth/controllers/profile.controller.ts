import { Request, Response, NextFunction } from 'express';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { 
  IProfileService,
  ServiceContainer 
} from '../services';
import type {
  CreateProfileRequest,
  UpdateProfileRequest,
  ProfileSearchRequest,
  TradieProfile,
  ClientProfile,
  EnterpriseProfile,
  ProfileResponse,
  ProfileListResponse,
  ProfileCompletion,
  QualityScore
} from '../types';

export interface IProfileController {
  createProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  getProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  deleteProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  searchProfiles(req: Request, res: Response, next: NextFunction): Promise<void>;
  getProfilesByRole(req: Request, res: Response, next: NextFunction): Promise<void>;
  uploadProfileImage(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateTradieServices(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateTradieAvailability(req: Request, res: Response, next: NextFunction): Promise<void>;
  addTradieQualification(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateTradieInsurance(req: Request, res: Response, next: NextFunction): Promise<void>;
  addPortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void>;
  getProfileCompletion(req: Request, res: Response, next: NextFunction): Promise<void>;
  getQualityScore(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  deactivateProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export class ProfileController implements IProfileController {
  private readonly profileService: IProfileService;
  private readonly logger = buildHiveLogger;

  constructor(serviceContainer: ServiceContainer) {
    this.profileService = serviceContainer.getProfileService();

    this.logger.info('ProfileController initialized', {
      controller: 'ProfileController',
      dependencies: ['ProfileService']
    });
  }

  async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      this.logger.info('Profile creation attempt', {
        userId,
        role: req.body.role,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      const profileData: CreateProfileRequest = {
        userId,
        role: req.body.role,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        displayName: req.body.displayName,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        phone: req.body.phone,
        email: req.body.email,
        alternatePhone: req.body.alternatePhone,
        preferredContact: req.body.preferredContact,
        address: req.body.address,
        businessInfo: req.body.businessInfo,
        tradieInfo: req.body.tradieInfo,
        clientInfo: req.body.clientInfo,
        enterpriseInfo: req.body.enterpriseInfo,
        metadata: {
          createdBy: userId,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.profileService.createProfile(profileData);

      this.logger.info('Profile created successfully', {
        userId,
        profileId: result.data.id,
        role: result.data.role
      });

      res.status(201).json(result);

    } catch (error) {
      this.logger.error('Profile creation failed', error, {
        userId: req.user?.id,
        role: req.body.role,
        ip: req.ip
      });

      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const requesterId = req.user?.id;

      this.logger.debug('Profile retrieval request', {
        profileId,
        requesterId,
        ip: req.ip
      });

      const result = await this.profileService.getProfileById(profileId);

      // Check if requester has permission to view full profile
      const canViewFullProfile = this.canViewFullProfile(requesterId, result.data);
      
      if (!canViewFullProfile) {
        // Return limited public profile data
        const publicProfile = this.filterPublicProfileData(result.data);
        const publicResult = buildHiveResponse.success(publicProfile, 'Public profile retrieved');
        
        this.logger.debug('Public profile retrieved', {
          profileId,
          requesterId,
          profileRole: result.data.role
        });

        return res.status(200).json(publicResult);
      }

      this.logger.debug('Full profile retrieved', {
        profileId,
        requesterId,
        profileRole: result.data.role
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile retrieval failed', error, {
        profileId: req.params.id,
        requesterId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Profile update attempt', {
        profileId,
        userId,
        fieldsToUpdate: Object.keys(req.body),
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      // Check if user owns the profile or has admin privileges
      await this.validateProfileOwnership(profileId, userId);

      const updateData: UpdateProfileRequest = {
        ...req.body,
        updatedBy: userId,
        metadata: {
          updatedBy: userId,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date()
        }
      };

      const result = await this.profileService.updateProfile(profileId, updateData);

      this.logger.info('Profile updated successfully', {
        profileId,
        userId,
        updatedFields: Object.keys(req.body)
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile update failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        fieldsToUpdate: Object.keys(req.body),
        ip: req.ip
      });

      next(error);
    }
  }

  async deleteProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;
      const reason = req.body.reason || 'User requested deletion';

      this.logger.info('Profile deletion attempt', {
        profileId,
        userId,
        reason,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      // Check if user owns the profile or has admin privileges
      await this.validateProfileOwnership(profileId, userId);

      const result = await this.profileService.deleteProfile(profileId, reason);

      this.logger.info('Profile deleted successfully', {
        profileId,
        userId,
        reason
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile deletion failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async searchProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = req.user?.id;

      this.logger.info('Profile search request', {
        requesterId,
        query: req.query.q,
        role: req.query.role,
        location: req.query.location,
        page: req.query.page,
        limit: req.query.limit,
        ip: req.ip
      });

      const searchParams: ProfileSearchRequest = {
        query: req.query.q as string,
        role: req.query.role as string,
        location: req.query.location as string,
        serviceCategories: req.query.serviceCategories as string[],
        availability: req.query.availability as string,
        rating: req.query.rating ? parseFloat(req.query.rating as string) : undefined,
        verified: req.query.verified === 'true',
        radius: req.query.radius ? parseInt(req.query.radius as string) : undefined,
        priceRange: {
          min: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
          max: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined
        },
        sortBy: req.query.sortBy as string || 'relevance',
        sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'desc',
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100) // Max 100 results per page
      };

      const result = await this.profileService.searchProfiles(searchParams);

      this.logger.info('Profile search completed', {
        requesterId,
        resultsCount: result.data.profiles.length,
        totalResults: result.data.pagination.total,
        page: result.data.pagination.page
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile search failed', error, {
        requesterId: req.user?.id,
        query: req.query.q,
        ip: req.ip
      });

      next(error);
    }
  }

  async getProfilesByRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.params.role;
      const requesterId = req.user?.id;

      this.logger.info('Get profiles by role request', {
        role,
        requesterId,
        page: req.query.page,
        limit: req.query.limit,
        ip: req.ip
      });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const result = await this.profileService.getProfilesByRole(role, { page, limit });

      this.logger.info('Profiles by role retrieved', {
        role,
        requesterId,
        resultsCount: result.data.profiles.length,
        totalResults: result.data.pagination.total
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Get profiles by role failed', error, {
        role: req.params.role,
        requesterId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async uploadProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;
      const imageType = req.body.type || 'avatar'; // avatar, cover, gallery

      this.logger.info('Profile image upload attempt', {
        profileId,
        userId,
        imageType,
        fileSize: req.file?.size,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      if (!req.file) {
        throw AuthErrorFactory.invalidInput('No image file provided');
      }

      await this.validateProfileOwnership(profileId, userId);

      const result = await this.profileService.uploadProfileImage(
        profileId,
        req.file.buffer,
        imageType
      );

      this.logger.info('Profile image uploaded successfully', {
        profileId,
        userId,
        imageType,
        imageUrl: result.data.imageUrl
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile image upload failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        imageType: req.body.type,
        ip: req.ip
      });

      next(error);
    }
  }

  async updateTradieServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Tradie services update attempt', {
        profileId,
        userId,
        serviceCategories: req.body.serviceCategories?.length,
        specializations: req.body.specializations?.length,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const serviceData = {
        serviceCategories: req.body.serviceCategories,
        specializations: req.body.specializations,
        hourlyRate: req.body.hourlyRate,
        calloutFee: req.body.calloutFee,
        minimumJobValue: req.body.minimumJobValue,
        travelRadius: req.body.travelRadius
      };

      const result = await this.profileService.updateTradieServices(profileId, serviceData);

      this.logger.info('Tradie services updated successfully', {
        profileId,
        userId,
        serviceCategories: serviceData.serviceCategories?.length
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Tradie services update failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async updateTradieAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Tradie availability update attempt', {
        profileId,
        userId,
        status: req.body.status,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const availabilityData = {
        status: req.body.status,
        workingHours: req.body.workingHours,
        serviceRadius: req.body.serviceRadius,
        emergencyAvailable: req.body.emergencyAvailable,
        weekendAvailable: req.body.weekendAvailable,
        unavailableDates: req.body.unavailableDates
      };

      const result = await this.profileService.updateTradieAvailability(profileId, availabilityData);

      this.logger.info('Tradie availability updated successfully', {
        profileId,
        userId,
        status: availabilityData.status
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Tradie availability update failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async addTradieQualification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Tradie qualification addition attempt', {
        profileId,
        userId,
        qualificationName: req.body.name,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const qualificationData = {
        name: req.body.name,
        issuingBody: req.body.issuingBody,
        issueDate: req.body.issueDate,
        expiryDate: req.body.expiryDate,
        certificateNumber: req.body.certificateNumber,
        verificationStatus: 'pending' as const,
        documents: req.body.documents || []
      };

      const result = await this.profileService.addTradieQualification(profileId, qualificationData);

      this.logger.info('Tradie qualification added successfully', {
        profileId,
        userId,
        qualificationName: qualificationData.name
      });

      res.status(201).json(result);

    } catch (error) {
      this.logger.error('Tradie qualification addition failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        qualificationName: req.body.name,
        ip: req.ip
      });

      next(error);
    }
  }

  async updateTradieInsurance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Tradie insurance update attempt', {
        profileId,
        userId,
        provider: req.body.provider,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const insuranceData = {
        provider: req.body.provider,
        policyNumber: req.body.policyNumber,
        coverageType: req.body.coverageType,
        coverageAmount: req.body.coverageAmount,
        expiryDate: req.body.expiryDate,
        documents: req.body.documents || []
      };

      const result = await this.profileService.updateTradieInsurance(profileId, insuranceData);

      this.logger.info('Tradie insurance updated successfully', {
        profileId,
        userId,
        provider: insuranceData.provider
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Tradie insurance update failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async addPortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.info('Portfolio item addition attempt', {
        profileId,
        userId,
        title: req.body.title,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const portfolioItem = {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        images: req.body.images || [],
        completionDate: req.body.completionDate,
        location: req.body.location,
        clientTestimonial: req.body.clientTestimonial,
        projectValue: req.body.projectValue,
        tags: req.body.tags || []
      };

      const result = await this.profileService.addPortfolioItem(profileId, portfolioItem);

      this.logger.info('Portfolio item added successfully', {
        profileId,
        userId,
        title: portfolioItem.title
      });

      res.status(201).json(result);

    } catch (error) {
      this.logger.error('Portfolio item addition failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        title: req.body.title,
        ip: req.ip
      });

      next(error);
    }
  }

  async getProfileCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.debug('Profile completion request', {
        profileId,
        userId,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const result = await this.profileService.calculateProfileCompletion(profileId);

      this.logger.debug('Profile completion calculated', {
        profileId,
        userId,
        completionPercentage: result.percentage
      });

      res.status(200).json(buildHiveResponse.success(result, 'Profile completion calculated'));

    } catch (error) {
      this.logger.error('Profile completion calculation failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async getQualityScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;

      this.logger.debug('Quality score request', {
        profileId,
        userId,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const result = await this.profileService.calculateQualityScore(profileId);

      this.logger.debug('Quality score calculated', {
        profileId,
        userId,
        qualityScore: result.score
      });

      res.status(200).json(buildHiveResponse.success(result, 'Quality score calculated'));

    } catch (error) {
      this.logger.error('Quality score calculation failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async verifyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const verifierId = req.user?.id;

      this.logger.info('Profile verification attempt', {
        profileId,
        verifierId,
        ip: req.ip
      });

      if (!verifierId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      // Only admin users can verify profiles
      if (!req.user?.roles?.includes('admin')) {
        throw AuthErrorFactory.forbidden('Insufficient permissions to verify profiles');
      }

      const result = await this.profileService.verifyProfile(profileId, verifierId);

      this.logger.info('Profile verified successfully', {
        profileId,
        verifierId
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile verification failed', error, {
        profileId: req.params.id,
        verifierId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  async deactivateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profileId = req.params.id;
      const userId = req.user?.id;
      const reason = req.body.reason;

      this.logger.info('Profile deactivation attempt', {
        profileId,
        userId,
        reason,
        ip: req.ip
      });

      if (!userId) {
        throw AuthErrorFactory.unauthorized('User not authenticated');
      }

      await this.validateProfileOwnership(profileId, userId);

      const result = await this.profileService.deactivateProfile(profileId, reason);

      this.logger.info('Profile deactivated successfully', {
        profileId,
        userId,
        reason
      });

      res.status(200).json(result);

    } catch (error) {
      this.logger.error('Profile deactivation failed', error, {
        profileId: req.params.id,
        userId: req.user?.id,
        ip: req.ip
      });

      next(error);
    }
  }

  // Utility Methods
  private async validateProfileOwnership(profileId: string, userId: string): Promise<void> {
    const profile = await this.profileService.getProfileById(profileId);
    
    if (profile.data.userId !== userId && !this.isAdminUser()) {
      throw AuthErrorFactory.forbidden('You do not have permission to modify this profile');
    }
  }

  private canViewFullProfile(requesterId: string | undefined, profile: any): boolean {
    // Profile owner can always view full profile
    if (requesterId === profile.userId) return true;
    
    // Admin users can view all profiles
    if (this.isAdminUser()) return true;
    
    // Public profiles can be viewed by authenticated users
    if (profile.visibility === 'public' && requesterId) return true;
    
    return false;
  }

  private filterPublicProfileData(profile: any): any {
    return {
      id: profile.id,
      displayName: profile.displayName,
      role: profile.role,
      ratings: profile.ratings,
      verificationStatus: profile.verificationStatus,
      media: {
        avatar: profile.media?.avatar,
        cover: profile.media?.cover
      },
      tradieInfo: profile.role === 'tradie' ? {
        serviceCategories: profile.tradieInfo?.serviceCategories,
        specializations: profile.tradieInfo?.specializations,
        yearsExperience: profile.tradieInfo?.yearsExperience,
        availability: {
          status: profile.tradieInfo?.availability?.status
        },
        portfolio: profile.tradieInfo?.portfolio?.slice(0, 3) // Show only first 3 items
      } : undefined,
      statistics: {
        jobsCompleted: profile.statistics?.jobsCompleted,
        responseRate: profile.statistics?.responseRate,
        onTimeCompletionRate: profile.statistics?.onTimeCompletionRate
      },
      createdAt: profile.createdAt
    };
  }

  private isAdminUser(): boolean {
    // This would typically check req.user but we need access to request context
    // In a real implementation, you'd pass this through or use a different pattern
    return false; // Placeholder - implement based on your auth system
  }

  private validateImageFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw AuthErrorFactory.invalidInput('Invalid image format. Only JPEG, PNG, and WebP are allowed');
    }

    if (file.size > maxSize) {
      throw AuthErrorFactory.invalidInput('Image file too large. Maximum size is 5MB');
    }
  }

  private sanitizeSearchParams(params: any): any {
    return {
      ...params,
      page: Math.max(1, parseInt(params.page) || 1),
      limit: Math.min(100, Math.max(1, parseInt(params.limit) || 20)),
      radius: params.radius ? Math.min(200, Math.max(1, parseInt(params.radius))) : undefined
    };
  }

  // Health check for profile controller
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'profile-controller',
        version: process.env.APP_VERSION || '1.0.0',
        dependencies: {
          profileService: 'connected'
        }
      };

      res.status(200).json(buildHiveResponse.success(health, 'Profile controller is healthy'));

    } catch (error) {
      this.logger.error('Profile controller health check failed', error);
      next(error);
    }
  }
}

// Export factory function for dependency injection
export function createProfileController(serviceContainer: ServiceContainer): IProfileController {
  return new ProfileController(serviceContainer);
}

export default ProfileController;
