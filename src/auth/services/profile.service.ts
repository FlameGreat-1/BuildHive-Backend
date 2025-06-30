import { Types } from 'mongoose';
import { IProfileRepository, IUserRepository } from '../repositories';
import { buildHiveLogger, AuthErrorFactory, buildHiveResponse } from '../../shared';
import { USER_ROLES } from '../../config';
import type {
  CreateProfileRequest,
  UpdateProfileRequest,
  ProfileQueryParams,
  ProfileData,
  TradieProfile,
  ClientProfile,
  EnterpriseProfile,
  ProfileResponse,
  ProfileListResponse,
  ServiceCategory,
  AvailabilityStatus,
  AustralianState,
  TradieQualification,
  TradieInsurance,
  PortfolioItem,
  ProfileCompletion,
  QualityScore
} from '../types';
import { IProfileDocument, IUserDocument } from '../models';

export interface IProfileService {
  createProfile(request: CreateProfileRequest): Promise<ProfileResponse>;
  getProfile(profileId: string): Promise<ProfileResponse>;
  getProfileByUserId(userId: string): Promise<ProfileResponse>;
  updateProfile(profileId: string, request: UpdateProfileRequest): Promise<ProfileResponse>;
  searchProfiles(params: ProfileQueryParams): Promise<ProfileListResponse>;
  updateTradieAvailability(profileId: string, status: AvailabilityStatus): Promise<ProfileResponse>;
  addTradieQualification(profileId: string, qualification: TradieQualification): Promise<ProfileResponse>;
  updateTradieInsurance(profileId: string, insurance: TradieInsurance): Promise<ProfileResponse>;
  addPortfolioItem(profileId: string, item: PortfolioItem): Promise<ProfileResponse>;
  calculateProfileCompletion(profileId: string): Promise<ProfileCompletion>;
  calculateQualityScore(profileId: string): Promise<QualityScore>;
  verifyProfile(profileId: string, verifiedBy: string): Promise<ProfileResponse>;
  deactivateProfile(profileId: string, reason?: string): Promise<ProfileResponse>;
  getProfileById(profileId: string): Promise<ProfileResponse>;
  deleteProfile(profileId: string, deletedBy: string): Promise<ProfileResponse>;
  getProfilesByRole(role: string, params?: ProfileQueryParams): Promise<ProfileListResponse>;
  uploadProfileImage(profileId: string, file: Buffer, type: 'avatar' | 'cover' | 'gallery'): Promise<string>;
  updateTradieServices(profileId: string, services: ServiceCategory[]): Promise<ProfileResponse>;
}

export interface IEventPublisher {
  publish(channel: string, event: any): Promise<void>;
}

export interface IFileUploadService {
  uploadProfileImage(file: Buffer, userId: string, type: 'avatar' | 'cover' | 'gallery'): Promise<string>;
  deleteProfileImage(url: string): Promise<void>;
}

export interface IGeolocationService {
  geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }>;
  calculateDistance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number;
}

export class ProfileService implements IProfileService {
  private readonly profileRepository: IProfileRepository;
  private readonly userRepository: IUserRepository;
  private readonly fileUploadService: IFileUploadService;
  private readonly geolocationService: IGeolocationService;
  private readonly eventPublisher: IEventPublisher;
  private readonly logger = buildHiveLogger;

  constructor(
    profileRepository: IProfileRepository,
    userRepository: IUserRepository,
    fileUploadService: IFileUploadService,
    geolocationService: IGeolocationService,
    eventPublisher: IEventPublisher
  ) {
    this.profileRepository = profileRepository;
    this.userRepository = userRepository;
    this.fileUploadService = fileUploadService;
    this.geolocationService = geolocationService;
    this.eventPublisher = eventPublisher;

    this.logger.info('ProfileService initialized', {
      service: 'ProfileService',
      dependencies: ['ProfileRepository', 'UserRepository', 'FileUploadService', 'GeolocationService', 'EventPublisher']
    });
  }

  async createProfile(request: CreateProfileRequest): Promise<ProfileResponse> {
    try {
      this.logger.info('Creating profile', {
        userId: request.userId,
        role: request.role
      });

      const user = await this.userRepository.findById(request.userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(request.userId);
      }

      const existingProfile = await this.profileRepository.findByUserId(request.userId);
      if (existingProfile) {
        throw AuthErrorFactory.profileAlreadyExists(request.userId);
      }

      await this.validateCreateProfileRequest(request);

      const profileData = await this.buildProfileData(request, user);
      const profile = await this.profileRepository.create(profileData);

      user.profileId = new Types.ObjectId(profile.id);
      await user.save();

      const profileResponse = await this.mapToProfileResponse(profile, user);

      await this.publishProfileEvent('profile.created', profile, {
        userId: request.userId,
        role: request.role
      });

      this.logger.info('Profile created successfully', {
        profileId: profile.id,
        userId: request.userId,
        role: request.role
      });

      return buildHiveResponse.success(profileResponse, 'Profile created successfully');

    } catch (error) {
      this.logger.error('Failed to create profile', error, {
        userId: request.userId,
        role: request.role
      });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileCreationFailed('Failed to create profile', error);
    }
  }

  async getProfile(profileId: string): Promise<ProfileResponse> {
    try {
      this.logger.debug('Fetching profile', { profileId });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const user = await this.userRepository.findById(profile.userId.toString());
      if (!user) {
        throw AuthErrorFactory.userNotFound(profile.userId.toString());
      }

      const profileResponse = await this.mapToProfileResponse(profile, user);

      await this.profileRepository.incrementViewCount(profileId);

      this.logger.debug('Profile fetched successfully', {
        profileId,
        role: profile.role
      });

      return buildHiveResponse.success(profileResponse, 'Profile retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch profile', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileNotFound(profileId);
    }
  }

  async getProfileByUserId(userId: string): Promise<ProfileResponse> {
    try {
      this.logger.debug('Fetching profile by user ID', { userId });

      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(`Profile not found for user ${userId}`);
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AuthErrorFactory.userNotFound(userId);
      }

      const profileResponse = await this.mapToProfileResponse(profile, user);

      return buildHiveResponse.success(profileResponse, 'Profile retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch profile by user ID', error, { userId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileNotFound(`Profile not found for user ${userId}`);
    }
  }

  async updateProfile(profileId: string, request: UpdateProfileRequest): Promise<ProfileResponse> {
    try {
      this.logger.info('Updating profile', {
        profileId,
        updatedBy: request.updatedBy
      });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const user = await this.userRepository.findById(profile.userId.toString());
      if (!user) {
        throw AuthErrorFactory.userNotFound(profile.userId.toString());
      }

      await this.validateUpdateProfileRequest(request, profile);

      const updateData = await this.buildUpdateData(request);
      const updatedProfile = await this.profileRepository.update(profileId, updateData);

      if (!updatedProfile) {
        throw AuthErrorFactory.profileUpdateFailed('Failed to update profile');
      }

      const profileResponse = await this.mapToProfileResponse(updatedProfile, user);

      await this.publishProfileEvent('profile.updated', updatedProfile, {
        updatedBy: request.updatedBy,
        changes: updateData
      });

      this.logger.info('Profile updated successfully', {
        profileId,
        updatedBy: request.updatedBy
      });

      return buildHiveResponse.success(profileResponse, 'Profile updated successfully');

    } catch (error) {
      this.logger.error('Failed to update profile', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileUpdateFailed('Failed to update profile', error);
    }
  }

  async searchProfiles(params: ProfileQueryParams): Promise<ProfileListResponse> {
    try {
      this.logger.debug('Searching profiles', {
        role: params.role,
        serviceCategories: params.serviceCategories,
        state: params.state,
        page: params.page,
        limit: params.limit
      });

      const filters = this.buildSearchFilters(params);
      const options = {
        page: params.page || 1,
        limit: Math.min(params.limit || 20, 100),
        sort: this.buildSortOptions(params.sort, params.order)
      };

      const result = await this.profileRepository.findPaginated(filters, options);
      const profiles = await Promise.all(
        result.docs.map(async (profile) => {
          const user = await this.userRepository.findById(profile.userId.toString());
          return this.mapToProfileListItem(profile, user!);
        })
      );

      const facets = await this.calculateSearchFacets(filters);

      this.logger.debug('Profile search completed', {
        total: result.totalDocs,
        page: result.page,
        totalPages: result.totalPages
      });

      return {
        success: true,
        message: 'Profiles retrieved successfully',
        data: profiles,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.totalDocs,
          totalPages: result.totalPages,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        },
        filters: params,
        facets,
        meta: {
          timestamp: new Date().toISOString(),
          version: 'v1'
        }
      };

    } catch (error) {
      this.logger.error('Failed to search profiles', error, { params });
      throw AuthErrorFactory.profileSearchFailed('Failed to search profiles', error);
    }
  }

  async updateTradieAvailability(profileId: string, status: AvailabilityStatus): Promise<ProfileResponse> {
    try {
      this.logger.info('Updating tradie availability', { profileId, status });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      if (profile.role !== USER_ROLES.TRADIE) {
        throw AuthErrorFactory.invalidOperation('Only tradie profiles can update availability');
      }

      const updateData = {
        'tradieInfo.availability.status': status,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('tradie.availability_updated', updatedProfile!, {
        oldStatus: profile.tradieInfo?.availability?.status,
        newStatus: status
      });

      this.logger.info('Tradie availability updated successfully', {
        profileId,
        status
      });

      return buildHiveResponse.success(profileResponse, 'Availability updated successfully');

    } catch (error) {
      this.logger.error('Failed to update tradie availability', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileUpdateFailed('Failed to update availability', error);
    }
  }

  async addTradieQualification(profileId: string, qualification: TradieQualification): Promise<ProfileResponse> {
    try {
      this.logger.info('Adding tradie qualification', {
        profileId,
        qualificationName: qualification.name
      });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      if (profile.role !== USER_ROLES.TRADIE) {
        throw AuthErrorFactory.invalidOperation('Only tradie profiles can add qualifications');
      }

      await this.validateQualification(qualification);

      const qualifications = profile.tradieInfo?.qualifications || [];
      qualifications.push(qualification);

      const updateData = {
        'tradieInfo.qualifications': qualifications,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('tradie.qualification_added', updatedProfile!, {
        qualification
      });

      this.logger.info('Tradie qualification added successfully', {
        profileId,
        qualificationName: qualification.name
      });

      return buildHiveResponse.success(profileResponse, 'Qualification added successfully');

    } catch (error) {
      this.logger.error('Failed to add tradie qualification', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileUpdateFailed('Failed to add qualification', error);
    }
  }

  async updateTradieInsurance(profileId: string, insurance: TradieInsurance): Promise<ProfileResponse> {
    try {
      this.logger.info('Updating tradie insurance', { profileId });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      if (profile.role !== USER_ROLES.TRADIE) {
        throw AuthErrorFactory.invalidOperation('Only tradie profiles can update insurance');
      }

      await this.validateInsurance(insurance);

      const updateData = {
        'tradieInfo.insurance': insurance,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('tradie.insurance_updated', updatedProfile!, {
        insurance
      });

      this.logger.info('Tradie insurance updated successfully', { profileId });

      return buildHiveResponse.success(profileResponse, 'Insurance updated successfully');

    } catch (error) {
      this.logger.error('Failed to update tradie insurance', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileUpdateFailed('Failed to update insurance', error);
    }
  }

  async addPortfolioItem(profileId: string, item: PortfolioItem): Promise<ProfileResponse> {
    try {
      this.logger.info('Adding portfolio item', {
        profileId,
        title: item.title
      });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      if (profile.role !== USER_ROLES.TRADIE) {
        throw AuthErrorFactory.invalidOperation('Only tradie profiles can add portfolio items');
      }

      await this.validatePortfolioItem(item);

      const portfolio = profile.tradieInfo?.portfolio || [];
      portfolio.push(item);

      const updateData = {
        'tradieInfo.portfolio': portfolio,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('tradie.portfolio_updated', updatedProfile!, {
        portfolioItem: item
      });

      this.logger.info('Portfolio item added successfully', {
        profileId,
        title: item.title
      });

      return buildHiveResponse.success(profileResponse, 'Portfolio item added successfully');

    } catch (error) {
      this.logger.error('Failed to add portfolio item', error, { profileId });

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.profileUpdateFailed('Failed to add portfolio item', error);
    }
  }

  async calculateProfileCompletion(profileId: string): Promise<ProfileCompletion> {
    try {
      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const missingFields: string[] = [];
      let totalFields = 0;
      let completedFields = 0;

      // Basic profile fields
      const basicFields = [
        { field: 'firstName', value: profile.firstName },
        { field: 'lastName', value: profile.lastName },
        { field: 'phone', value: profile.phone },
        { field: 'email', value: profile.email },
        { field: 'address', value: profile.address }
      ];

      basicFields.forEach(({ field, value }) => {
        totalFields++;
        if (value) {
          completedFields++;
        } else {
          missingFields.push(field);
        }
      });

      // Role-specific fields
      if (profile.role === USER_ROLES.TRADIE) {
        const tradieFields = [
          { field: 'serviceCategories', value: profile.tradieInfo?.serviceCategories?.length },
          { field: 'hourlyRate', value: profile.tradieInfo?.hourlyRate },
          { field: 'yearsExperience', value: profile.tradieInfo?.yearsExperience },
          { field: 'availability', value: profile.tradieInfo?.availability },
          { field: 'qualifications', value: profile.tradieInfo?.qualifications?.length },
          { field: 'insurance', value: profile.tradieInfo?.insurance }
        ];

        tradieFields.forEach(({ field, value }) => {
          totalFields++;
          if (value) {
            completedFields++;
          } else {
            missingFields.push(field);
          }
        });
      }

      if (profile.role === USER_ROLES.ENTERPRISE) {
        const enterpriseFields = [
          { field: 'companySize', value: profile.enterpriseInfo?.companySize },
          { field: 'industry', value: profile.enterpriseInfo?.industry?.length },
          { field: 'teamStructure', value: profile.enterpriseInfo?.teamStructure },
          { field: 'serviceAreas', value: profile.enterpriseInfo?.serviceAreas?.length }
        ];

        enterpriseFields.forEach(({ field, value }) => {
          totalFields++;
          if (value) {
            completedFields++;
          } else {
            missingFields.push(field);
          }
        });
      }

      const percentage = Math.round((completedFields / totalFields) * 100);

      const completion: ProfileCompletion = {
        percentage,
        missingFields,
        lastCalculated: new Date()
      };

      await this.profileRepository.updateCompletion(profileId, completion);

      return completion;

    } catch (error) {
      this.logger.error('Failed to calculate profile completion', error, { profileId });
      throw AuthErrorFactory.profileCalculationFailed('Failed to calculate profile completion', error);
    }
  }

  async calculateQualityScore(profileId: string): Promise<QualityScore> {
    try {
      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const completion = await this.calculateProfileCompletion(profileId);
      
      const factors = {
        profileCompleteness: completion.percentage / 100,
        verificationStatus: this.calculateVerificationScore(profile),
        reviewRating: this.calculateReviewScore(profile),
        responseTime: this.calculateResponseScore(profile),
        jobCompletionRate: this.calculateCompletionScore(profile)
      };

      const weights = {
        profileCompleteness: 0.25,
        verificationStatus: 0.20,
        reviewRating: 0.25,
        responseTime: 0.15,
        jobCompletionRate: 0.15
      };

      const score = Math.round(
        (factors.profileCompleteness * weights.profileCompleteness +
         factors.verificationStatus * weights.verificationStatus +
         factors.reviewRating * weights.reviewRating +
         factors.responseTime * weights.responseTime +
         factors.jobCompletionRate * weights.jobCompletionRate) * 100
      );

      const qualityScore: QualityScore = {
        score,
        factors,
        lastCalculated: new Date()
      };

      await this.profileRepository.updateQualityScore(profileId, qualityScore);

      return qualityScore;

    } catch (error) {
      this.logger.error('Failed to calculate quality score', error, { profileId });
      throw AuthErrorFactory.profileCalculationFailed('Failed to calculate quality score', error);
    }
  }

  async verifyProfile(profileId: string, verifiedBy: string): Promise<ProfileResponse> {
    try {
      this.logger.info('Verifying profile', { profileId, verifiedBy });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const updateData = {
        verificationStatus: 'verified' as const,
        verifiedAt: new Date(),
        verifiedBy,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('profile.verified', updatedProfile!, {
        verifiedBy
      });

      this.logger.info('Profile verified successfully', { profileId, verifiedBy });

      return buildHiveResponse.success(profileResponse, 'Profile verified successfully');

    } catch (error) {
      this.logger.error('Failed to verify profile', error, { profileId });
      throw AuthErrorFactory.profileVerificationFailed('Failed to verify profile', error);
    }
  }

  async deactivateProfile(profileId: string, reason?: string): Promise<ProfileResponse> {
    try {
      this.logger.info('Deactivating profile', { profileId, reason });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const updateData = {
        status: 'inactive' as const,
        deactivatedAt: new Date(),
        deactivationReason: reason,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('profile.deactivated', updatedProfile!, {
        reason
      });

      this.logger.info('Profile deactivated successfully', { profileId, reason });

      return buildHiveResponse.success(profileResponse, 'Profile deactivated successfully');

    } catch (error) {
      this.logger.error('Failed to deactivate profile', error, { profileId });
      throw AuthErrorFactory.profileUpdateFailed('Failed to deactivate profile', error);
    }
  }

  private async mapToProfileResponse(profile: IProfileDocument, user: IUserDocument): Promise<TradieProfile | ClientProfile | EnterpriseProfile> {
    const baseProfile: ProfileData = {
      id: profile.id,
      userId: profile.userId.toString(),
      role: profile.role,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      phone: profile.phone,
      email: profile.email,
      alternatePhone: profile.alternatePhone,
      preferredContact: profile.preferredContact,
      address: profile.address,
      media: profile.media || { gallery: [] },
      businessInfo: profile.businessInfo,
      verificationDocuments: profile.verificationDocuments || [],
      ratings: profile.ratings || {
        overall: 0,
        totalReviews: 0,
        breakdown: { quality: 0, communication: 0, timeliness: 0, professionalism: 0, value: 0 },
        recentReviews: []
      },
      statistics: profile.statistics || {
        profileViews: 0,
        jobsCompleted: 0,
        jobsInProgress: 0,
        responseTime: 0,
        responseRate: 0,
        repeatClientRate: 0,
        onTimeCompletionRate: 0,
        lastActiveDate: new Date(),
        joinDate: profile.createdAt
      },
      profileCompletion: profile.profileCompletion || { percentage: 0, missingFields: [], lastCalculated: new Date() },
      qualityScore: profile.qualityScore || { score: 0, factors: {}, lastCalculated: new Date() },
      status: user.status,
      verificationStatus: user.verificationStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      platform: user.platform,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };

    switch (profile.role) {
      case USER_ROLES.TRADIE:
        return {
          ...baseProfile,
          role: 'tradie',
          tradieInfo: profile.tradieInfo || {
            serviceCategories: [],
            specializations: [],
            qualifications: [],
            availability: {
              status: 'available',
              workingHours: {
                monday: { start: '08:00', end: '17:00', available: true },
                tuesday: { start: '08:00', end: '17:00', available: true },
                wednesday: { start: '08:00', end: '17:00', available: true },
                thursday: { start: '08:00', end: '17:00', available: true },
                friday: { start: '08:00', end: '17:00', available: true },
                saturday: { start: '08:00', end: '17:00', available: false },
                sunday: { start: '08:00', end: '17:00', available: false }
              },
              serviceRadius: 50,
              emergencyAvailable: false,
              weekendAvailable: false
            },
            portfolio: [],
            yearsExperience: 0,
            completedJobs: 0,
            quotingPreferences: {
              providesQuotes: true,
              quoteValidityDays: 30
            }
          }
        } as TradieProfile;

      case USER_ROLES.CLIENT:
        return {
          ...baseProfile,
          role: 'client',
          clientInfo: profile.clientInfo || {
            jobHistory: [],
            preferredTradies: [],
            communicationPreferences: {
              receiveQuotes: true,
              receiveUpdates: true,
              receiveMarketing: false,
              preferredTimeToContact: 'business_hours'
            }
          }
        } as ClientProfile;

      case USER_ROLES.ENTERPRISE:
        return {
          ...baseProfile,
          role: 'enterprise',
          enterpriseInfo: profile.enterpriseInfo || {
            companySize: 'small',
            industry: [],
            teamStructure: {
              totalEmployees: 0,
              departments: [],
              managementLevels: 0
            },
            serviceAreas: [],
            certifications: [],
            operationalPreferences: {
              preferredWorkingHours: {
                start: '08:00',
                end: '17:00'
              },
              projectTypes: [],
              minimumProjectValue: 0,
              maximumProjectValue: 0
            },
            clientPortfolio: []
          }
        } as EnterpriseProfile;

      default:
        throw AuthErrorFactory.invalidRole(`Invalid profile role: ${profile.role}`);
    }
  }

  private calculateVerificationScore(profile: IProfileDocument): number {
    let score = 0;
    if (profile.verificationStatus === 'verified') score += 0.5;
    if (profile.verificationDocuments && profile.verificationDocuments.length > 0) score += 0.3;
    if (profile.businessInfo?.abn || profile.businessInfo?.acn) score += 0.2;
    return Math.min(score, 1);
  }

  private calculateReviewScore(profile: IProfileDocument): number {
    const rating = profile.ratings?.overall || 0;
    const reviewCount = profile.ratings?.totalReviews || 0;
    
    if (reviewCount === 0) return 0;
    if (reviewCount < 5) return (rating / 5) * 0.7;
    if (reviewCount < 20) return (rating / 5) * 0.85;
    return rating / 5;
  }

  private calculateResponseScore(profile: IProfileDocument): number {
    const responseTime = profile.statistics?.responseTime || 0;
    if (responseTime === 0) return 0;
    if (responseTime <= 1) return 1;
    if (responseTime <= 4) return 0.8;
    if (responseTime <= 24) return 0.6;
    return 0.3;
  }

  private calculateCompletionScore(profile: IProfileDocument): number {
    const completionRate = profile.statistics?.onTimeCompletionRate || 0;
    return completionRate / 100;
  }

  private async validateQualification(qualification: TradieQualification): Promise<void> {
    if (!qualification.name || qualification.name.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Qualification name is required');
    }

    if (!qualification.issuingBody || qualification.issuingBody.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Issuing body is required');
    }

    if (qualification.expiryDate && qualification.expiryDate < new Date()) {
      throw AuthErrorFactory.invalidInput('Qualification has expired');
    }
  }

  private async validateInsurance(insurance: TradieInsurance): Promise<void> {
    if (!insurance.provider || insurance.provider.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Insurance provider is required');
    }

    if (!insurance.policyNumber || insurance.policyNumber.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Policy number is required');
    }

    if (insurance.expiryDate < new Date()) {
      throw AuthErrorFactory.invalidInput('Insurance policy has expired');
    }

    if (insurance.coverageAmount <= 0) {
      throw AuthErrorFactory.invalidInput('Coverage amount must be greater than 0');
    }
  }

  private async validatePortfolioItem(item: PortfolioItem): Promise<void> {
    if (!item.title || item.title.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Portfolio item title is required');
    }

    if (!item.description || item.description.trim().length === 0) {
      throw AuthErrorFactory.invalidInput('Portfolio item description is required');
    }

    if (!item.images || item.images.length === 0) {
      throw AuthErrorFactory.invalidInput('At least one image is required for portfolio item');
    }
  }

  async getProfileById(profileId: string): Promise<ProfileResponse> {
    return this.getProfile(profileId);
  }

  async deleteProfile(profileId: string, deletedBy: string): Promise<ProfileResponse> {
    try {
      this.logger.info('Deleting profile', { profileId, deletedBy });

      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const updateData = {
        status: 'deleted' as const,
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      await this.publishProfileEvent('profile.deleted', updatedProfile!, { deletedBy });

      return buildHiveResponse.success(profileResponse, 'Profile deleted successfully');
    } catch (error) {
      this.logger.error('Failed to delete profile', error, { profileId });
      throw AuthErrorFactory.profileUpdateFailed('Failed to delete profile', error);
    }
  }

  async getProfilesByRole(role: string, params?: ProfileQueryParams): Promise<ProfileListResponse> {
    const searchParams = { ...params, role };
    return this.searchProfiles(searchParams);
  }

  async uploadProfileImage(profileId: string, file: Buffer, type: 'avatar' | 'cover' | 'gallery'): Promise<string> {
    try {
      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      const imageUrl = await this.fileUploadService.uploadProfileImage(file, profile.userId.toString(), type);

      const updateData: any = { updatedAt: new Date() };
      if (type === 'avatar') {
        updateData['media.avatar'] = imageUrl;
      } else if (type === 'cover') {
        updateData['media.coverImage'] = imageUrl;
      } else {
        const gallery = profile.media?.gallery || [];
        gallery.push(imageUrl);
        updateData['media.gallery'] = gallery;
      }

      await this.profileRepository.update(profileId, updateData);

      return imageUrl;
    } catch (error) {
      this.logger.error('Failed to upload profile image', error, { profileId });
      throw AuthErrorFactory.profileUpdateFailed('Failed to upload image', error);
    }
  }

  async updateTradieServices(profileId: string, services: ServiceCategory[]): Promise<ProfileResponse> {
    try {
      const profile = await this.profileRepository.findById(profileId);
      if (!profile) {
        throw AuthErrorFactory.profileNotFound(profileId);
      }

      if (profile.role !== USER_ROLES.TRADIE) {
        throw AuthErrorFactory.invalidOperation('Only tradie profiles can update services');
      }

      const updateData = {
        'tradieInfo.serviceCategories': services,
        updatedAt: new Date()
      };

      const updatedProfile = await this.profileRepository.update(profileId, updateData);
      const user = await this.userRepository.findById(profile.userId.toString());

      const profileResponse = await this.mapToProfileResponse(updatedProfile!, user!);

      return buildHiveResponse.success(profileResponse, 'Services updated successfully');
    } catch (error) {
      this.logger.error('Failed to update tradie services', error, { profileId });
      throw AuthErrorFactory.profileUpdateFailed('Failed to update services', error);
    }
  }

  private async publishProfileEvent(eventType: string, profile: IProfileDocument | null, metadata: any): Promise<void> {
    try {
      const event = {
        type: eventType,
        profileId: profile?.id,
        userId: profile?.userId?.toString(),
        timestamp: new Date(),
        metadata
      };

      await this.eventPublisher.publish('profile.events', event);
    } catch (error) {
      this.logger.warn('Failed to publish profile event', error, { eventType });
    }
  }
}

 