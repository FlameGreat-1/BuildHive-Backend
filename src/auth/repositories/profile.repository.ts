import { FilterQuery, UpdateQuery, QueryOptions, Types } from 'mongoose';
import { Profile, IProfileDocument } from '../models';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import { USER_ROLES, VERIFICATION_STATUS, SERVICE_CATEGORIES, AVAILABILITY_STATUS } from '../../config';
import type { UserRole, PaginationOptions, SortOptions } from '../../shared/types';

// Repository interface following Interface Segregation Principle
export interface IProfileRepository {
  // Core CRUD operations
  create(profileData: Partial<IProfileDocument>): Promise<IProfileDocument>;
  findById(id: string): Promise<IProfileDocument | null>;
  findByUserId(userId: string): Promise<IProfileDocument | null>;
  update(id: string, updateData: Partial<IProfileDocument>): Promise<IProfileDocument | null>;
  delete(id: string): Promise<boolean>;
  
  // Role-specific operations
  findTradieProfiles(options?: {
    serviceCategories?: string[];
    location?: { state: string; suburb?: string; radius?: number };
    availability?: string;
    minRating?: number;
    verified?: boolean;
    pagination?: PaginationOptions;
  }): Promise<{
    profiles: IProfileDocument[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  findClientProfiles(options?: PaginationOptions): Promise<IProfileDocument[]>;
  findEnterpriseProfiles(options?: PaginationOptions): Promise<IProfileDocument[]>;
  
  // Verification operations
  findProfilesRequiringVerification(): Promise<IProfileDocument[]>;
  updateVerificationStatus(id: string, status: string, notes?: string): Promise<boolean>;
  uploadVerificationDocument(id: string, document: {
    type: string;
    url: string;
    uploadedAt?: Date;
  }): Promise<boolean>;
  
  // Business operations
  updateBusinessInfo(id: string, businessInfo: any): Promise<IProfileDocument | null>;
  updateTradieInfo(id: string, tradieInfo: any): Promise<IProfileDocument | null>;
  updateAvailability(id: string, availability: any): Promise<boolean>;
  
  // Rating and review operations
  updateRating(id: string, newRating: {
    overall: number;
    breakdown: {
      quality: number;
      communication: number;
      timeliness: number;
      professionalism: number;
      value: number;
    };
  }): Promise<boolean>;
  
  // Location-based operations
  findProfilesByLocation(state: string, suburb?: string, radius?: number): Promise<IProfileDocument[]>;
  findProfilesInServiceRadius(latitude: number, longitude: number, maxRadius: number): Promise<IProfileDocument[]>;
  
  // Search and filtering
  searchProfiles(query: {
    searchTerm?: string;
    serviceCategories?: string[];
    location?: string;
    minRating?: number;
    maxHourlyRate?: number;
    availability?: string;
    verified?: boolean;
  }, options?: PaginationOptions): Promise<{
    profiles: IProfileDocument[];
    total: number;
    facets: {
      serviceCategories: { category: string; count: number }[];
      locations: { location: string; count: number }[];
      ratingRanges: { range: string; count: number }[];
    };
  }>;
  
  // Analytics operations
  getProfileStatistics(): Promise<{
    totalProfiles: number;
    profilesByRole: Record<UserRole, number>;
    verificationStats: Record<string, number>;
    averageRatings: Record<string, number>;
    serviceDistribution: { category: string; count: number }[];
    locationDistribution: { state: string; count: number }[];
  }>;
  
  // Portfolio operations
  addPortfolioItem(id: string, portfolioItem: any): Promise<boolean>;
  updatePortfolioItem(id: string, itemId: string, updateData: any): Promise<boolean>;
  removePortfolioItem(id: string, itemId: string): Promise<boolean>;
  
  // Qualification operations
  addQualification(id: string, qualification: any): Promise<boolean>;
  updateQualification(id: string, qualificationId: string, updateData: any): Promise<boolean>;
  removeQualification(id: string, qualificationId: string): Promise<boolean>;
}

// Profile Repository implementation following Single Responsibility Principle
export class ProfileRepository implements IProfileRepository {
  private readonly model = Profile;
  private readonly logger = buildHiveLogger;

  constructor() {
    this.logger.info('ProfileRepository initialized', {
      model: this.model.modelName,
      collection: this.model.collection.name,
    });
  }

  // Core CRUD Operations

  /**
   * Create a new profile
   * Follows Single Responsibility: Only handles profile creation
   */
  async create(profileData: Partial<IProfileDocument>): Promise<IProfileDocument> {
    try {
      this.logger.info('Creating new profile', {
        userId: profileData.userId,
        role: profileData.role,
      });

      // Validate required fields based on role
      this.validateProfileData(profileData);

      const profile = new this.model(profileData);
      const savedProfile = await profile.save();

      // Calculate initial profile completion
      savedProfile.calculateProfileCompletion();
      await savedProfile.save();

      this.logger.info('Profile created successfully', {
        profileId: savedProfile._id,
        userId: savedProfile.userId,
        role: savedProfile.role,
        completionPercentage: savedProfile.profileCompletion.percentage,
      });

      // Emit profile creation event for event-driven architecture
      await this.emitProfileEvent('profile.created', savedProfile);

      return savedProfile;
    } catch (error) {
      this.logger.error('Failed to create profile', error, {
        profileData: { ...profileData, userId: profileData.userId },
      });

      if (error.code === 11000) {
        throw AuthErrorFactory.duplicateProfile();
      }

      throw AuthErrorFactory.databaseError('Failed to create profile', error);
    }
  }

  /**
   * Find profile by ID
   * Optimized with population for related data
   */
  async findById(id: string): Promise<IProfileDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      const profile = await this.model
        .findById(id)
        .populate('userId', 'username email phone status')
        .lean()
        .exec();

      if (profile) {
        this.logger.debug('Profile found by ID', {
          profileId: id,
          userId: profile.userId,
          role: profile.role,
        });
      }

      return profile as IProfileDocument;
    } catch (error) {
      this.logger.error('Failed to find profile by ID', error, { profileId: id });
      throw AuthErrorFactory.databaseError('Failed to find profile', error);
    }
  }

  /**
   * Find profile by user ID
   * Most common lookup for user-profile relationship
   */
  async findByUserId(userId: string): Promise<IProfileDocument | null> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw AuthErrorFactory.invalidInput('Invalid user ID format');
      }

      const profile = await this.model
        .findOne({ userId: new Types.ObjectId(userId) })
        .populate('userId', 'username email phone status')
        .exec();

      if (profile) {
        this.logger.debug('Profile found by user ID', {
          profileId: profile._id,
          userId,
          role: profile.role,
        });
      }

      return profile;
    } catch (error) {
      this.logger.error('Failed to find profile by user ID', error, { userId });
      throw AuthErrorFactory.databaseError('Failed to find profile', error);
    }
  }

  /**
   * Update profile data
   * Follows Open-Closed Principle: extensible for new update types
   */
  async update(id: string, updateData: Partial<IProfileDocument>): Promise<IProfileDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      // Sanitize update data
      const sanitizedData = this.sanitizeUpdateData(updateData);
      
      // Add audit trail
      sanitizedData.updatedAt = new Date();

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { $set: sanitizedData },
          { 
            new: true, 
            runValidators: true 
          }
        )
        .populate('userId', 'username email phone status')
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      // Recalculate profile completion
      profile.calculateProfileCompletion();
      await profile.save();

      this.logger.info('Profile updated successfully', {
        profileId: id,
        userId: profile.userId,
        updatedFields: Object.keys(sanitizedData),
        newCompletionPercentage: profile.profileCompletion.percentage,
      });

      // Emit profile update event
      await this.emitProfileEvent('profile.updated', profile, { 
        updatedFields: Object.keys(sanitizedData) 
      });

      return profile;
    } catch (error) {
      this.logger.error('Failed to update profile', error, { 
        profileId: id, 
        updateData 
      });
      
      throw AuthErrorFactory.databaseError('Failed to update profile', error);
    }
  }

// Add these missing private methods to ProfileRepository class:
private validateProfileData(profileData: any): void {
  if (!profileData.role) throw AuthErrorFactory.invalidInput('Role is required');
  if (!profileData.firstName) throw AuthErrorFactory.invalidInput('First name is required');
  if (!profileData.lastName) throw AuthErrorFactory.invalidInput('Last name is required');
}

private sanitizeUpdateData(updateData: any): any {
  const { _id, userId, createdAt, ...sanitized } = updateData;
  return sanitized;
}

private async emitProfileEvent(eventName: string, profile: any, metadata?: any): Promise<void> {
  this.logger.info(`Profile event: ${eventName}`, { profileId: profile._id, ...metadata });
}

private isValidABN(abn: string): boolean {
  return /^\d{11}$/.test(abn.replace(/\s/g, ''));
}

private maskIdentifier(identifier: string): string {
  return identifier.replace(/(.{2}).*(.{2})/, '$1***$2');
}

private maskEmail(email: string): string {
  return email.replace(/(.{2}).*(@.*)/, '$1***$2');
}

private maskPhone(phone: string): string {
  return phone.replace(/(.{2}).*(.{2})/, '$1***$2');
}

  /**
   * Soft delete profile (following GDPR compliance)
   */
  async delete(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      // Soft delete - mark as deleted instead of removing
      const result = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              deletedAt: new Date(),
              // Anonymize sensitive data for GDPR compliance
              firstName: 'Deleted',
              lastName: 'User',
              phone: null,
              'businessInfo.abn': null,
              'businessInfo.acn': null,
            }
          },
          { new: true }
        )
        .exec();

      if (!result) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Profile soft deleted', {
        profileId: id,
        userId: result.userId,
        deletedAt: result.deletedAt,
      });

      // Emit profile deletion event
      await this.emitProfileEvent('profile.deleted', result);

      return true;
    } catch (error) {
      this.logger.error('Failed to delete profile', error, { profileId: id });
      throw AuthErrorFactory.databaseError('Failed to delete profile', error);
    }
  }

  // Role-specific Operations

  /**
   * Find tradie profiles with advanced filtering
   * Core functionality for BuildHive marketplace
   */
  async findTradieProfiles(options?: {
    serviceCategories?: string[];
    location?: { state: string; suburb?: string; radius?: number };
    availability?: string;
    minRating?: number;
    verified?: boolean;
    pagination?: PaginationOptions;
  }): Promise<{
    profiles: IProfileDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = options?.pagination?.page || 1;
      const limit = options?.pagination?.limit || 20;
      const skip = (page - 1) * limit;

      // Build query for tradie profiles
      const query: FilterQuery<IProfileDocument> = {
        role: USER_ROLES.TRADIE,
        deletedAt: { $exists: false },
      };

      // Service category filter
      if (options?.serviceCategories && options.serviceCategories.length > 0) {
        query['tradieInfo.serviceCategories'] = { $in: options.serviceCategories };
      }

      // Location filter
      if (options?.location) {
        query['address.state'] = options.location.state.toUpperCase();
        if (options.location.suburb) {
          query['address.suburb'] = new RegExp(options.location.suburb, 'i');
        }
      }

      // Availability filter
      if (options?.availability) {
        query['tradieInfo.availability.status'] = options.availability;
      }

      // Rating filter
      if (options?.minRating) {
        query['ratings.overall'] = { $gte: options.minRating };
      }

      // Verification filter
      if (options?.verified === true) {
        query['verification.status'] = VERIFICATION_STATUS.VERIFIED;
      }

      const [profiles, total] = await Promise.all([
        this.model
          .find(query)
          .populate('userId', 'username email status lastLogin')
          .sort({ 
            'ratings.overall': -1, 
            'tradieInfo.hourlyRate': 1,
            updatedAt: -1 
          })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(query)
      ]);

      this.logger.debug('Tradie profiles found', {
        count: profiles.length,
        total,
        filters: options,
      });

      return {
        profiles: profiles as IProfileDocument[],
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to find tradie profiles', error, { options });
      throw AuthErrorFactory.databaseError('Failed to find tradie profiles', error);
    }
  }

  /**
   * Find client profiles
   * For enterprise features and client management
   */
  async findClientProfiles(options?: PaginationOptions): Promise<IProfileDocument[]> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 50;
      const skip = (page - 1) * limit;

      const profiles = await this.model
        .find({
          role: USER_ROLES.CLIENT,
          deletedAt: { $exists: false },
        })
        .populate('userId', 'username email status lastLogin')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      this.logger.debug('Client profiles found', {
        count: profiles.length,
        page,
        limit,
      });

      return profiles as IProfileDocument[];
    } catch (error) {
      this.logger.error('Failed to find client profiles', error);
      throw AuthErrorFactory.databaseError('Failed to find client profiles', error);
    }
  }

  /**
   * Find enterprise profiles
   * For B2B features and team management
   */
  async findEnterpriseProfiles(options?: PaginationOptions): Promise<IProfileDocument[]> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 30;
      const skip = (page - 1) * limit;

      const profiles = await this.model
        .find({
          role: USER_ROLES.ENTERPRISE,
          deletedAt: { $exists: false },
        })
        .populate('userId', 'username email status lastLogin')
        .sort({ 'businessInfo.teamSize': -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      this.logger.debug('Enterprise profiles found', {
        count: profiles.length,
        page,
        limit,
      });

      return profiles as IProfileDocument[];
    } catch (error) {
      this.logger.error('Failed to find enterprise profiles', error);
      throw AuthErrorFactory.databaseError('Failed to find enterprise profiles', error);
    }
  }

  // Verification Operations

  /**
   * Find profiles requiring verification
   * For admin dashboard and verification workflows
   */
  async findProfilesRequiringVerification(): Promise<IProfileDocument[]> {
    try {
      const profiles = await this.model
        .find({
          'verification.status': VERIFICATION_STATUS.PENDING,
          deletedAt: { $exists: false },
        })
        .populate('userId', 'username email phone')
        .sort({ 'verification.submittedAt': 1 }) // Oldest first
        .lean()
        .exec();

      this.logger.debug('Profiles requiring verification found', {
        count: profiles.length,
      });

      return profiles as IProfileDocument[];
    } catch (error) {
      this.logger.error('Failed to find profiles requiring verification', error);
      throw AuthErrorFactory.databaseError('Failed to find profiles requiring verification', error);
    }
  }

  /**
   * Update verification status
   * For admin verification workflow
   */
  async updateVerificationStatus(id: string, status: string, notes?: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      if (!Object.values(VERIFICATION_STATUS).includes(status)) {
        throw AuthErrorFactory.invalidInput('Invalid verification status');
      }

      const updateData: any = {
        'verification.status': status,
        'verification.reviewedAt': new Date(),
      };

      if (notes) {
        updateData['verification.notes'] = notes;
      }

      const profile = await this.model
        .findByIdAndUpdate(id, { $set: updateData }, { new: true })
        .populate('userId', 'username email')
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Verification status updated', {
        profileId: id,
        userId: profile.userId,
        status,
        notes,
      });

      // Emit verification event
      await this.emitProfileEvent('profile.verification_updated', profile, { 
        status, 
        notes 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update verification status', error, { 
        profileId: id, 
        status, 
        notes 
      });
      throw AuthErrorFactory.databaseError('Failed to update verification status', error);
    }
  }

  /**
   * Upload verification document
   * For document-based verification process
   */
  async uploadVerificationDocument(id: string, document: {
    type: string;
    url: string;
    uploadedAt?: Date;
  }): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      const documentData = {
        ...document,
        uploadedAt: document.uploadedAt || new Date(),
      };

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $push: { 'verification.documents': documentData },
            $set: { 
              'verification.status': VERIFICATION_STATUS.PENDING,
              'verification.submittedAt': new Date(),
            }
          },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Verification document uploaded', {
        profileId: id,
        userId: profile.userId,
        documentType: document.type,
      });

      // Emit document upload event
      await this.emitProfileEvent('profile.document_uploaded', profile, { 
        documentType: document.type 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to upload verification document', error, { 
        profileId: id, 
        document 
      });
      throw AuthErrorFactory.databaseError('Failed to upload verification document', error);
    }
  }

  // Business Operations

  /**
   * Update business information
   * For enterprise and tradie business details
   */
  async updateBusinessInfo(id: string, businessInfo: any): Promise<IProfileDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      // Validate ABN if provided
      if (businessInfo.abn && !this.isValidABN(businessInfo.abn)) {
        throw AuthErrorFactory.invalidInput('Invalid ABN format');
      }

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              businessInfo: {
                ...businessInfo,
                updatedAt: new Date(),
              }
            }
          },
          { new: true, runValidators: true }
        )
        .populate('userId', 'username email')
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      // Recalculate profile completion
      profile.calculateProfileCompletion();
      await profile.save();

      this.logger.info('Business info updated', {
        profileId: id,
        userId: profile.userId,
        abn: businessInfo.abn,
      });

      // Emit business info update event
      await this.emitProfileEvent('profile.business_info_updated', profile);

      return profile;
    } catch (error) {
      this.logger.error('Failed to update business info', error, { 
        profileId: id, 
        businessInfo 
      });
      throw AuthErrorFactory.databaseError('Failed to update business info', error);
    }
  }

  /**
   * Update tradie-specific information
   * For tradie profiles and service details
   */
  async updateTradieInfo(id: string, tradieInfo: any): Promise<IProfileDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      // Validate service categories
      if (tradieInfo.serviceCategories) {
        const validCategories = tradieInfo.serviceCategories.every((cat: string) =>
          Object.values(SERVICE_CATEGORIES).includes(cat)
        );
        if (!validCategories) {
          throw AuthErrorFactory.invalidInput('Invalid service categories');
        }
      }

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              tradieInfo: {
                ...tradieInfo,
                updatedAt: new Date(),
              }
            }
          },
          { new: true, runValidators: true }
        )
        .populate('userId', 'username email')
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      // Recalculate profile completion
      profile.calculateProfileCompletion();
      await profile.save();

      this.logger.info('Tradie info updated', {
        profileId: id,
        userId: profile.userId,
        serviceCategories: tradieInfo.serviceCategories,
        hourlyRate: tradieInfo.hourlyRate,
      });

      // Emit tradie info update event
      await this.emitProfileEvent('profile.tradie_info_updated', profile);

      return profile;
    } catch (error) {
      this.logger.error('Failed to update tradie info', error, { 
        profileId: id, 
        tradieInfo 
      });
      throw AuthErrorFactory.databaseError('Failed to update tradie info', error);
    }
  }

  /**
   * Update availability status
   * For tradie availability management
   */
  async updateAvailability(id: string, availability: any): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      if (availability.status && !Object.values(AVAILABILITY_STATUS).includes(availability.status)) {
        throw AuthErrorFactory.invalidInput('Invalid availability status');
      }

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { 
            $set: { 
              'tradieInfo.availability': {
                ...availability,
                updatedAt: new Date(),
              }
            }
          },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Availability updated', {
        profileId: id,
        userId: profile.userId,
        status: availability.status,
      });

      // Emit availability update event
      await this.emitProfileEvent('profile.availability_updated', profile, { 
        availability 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update availability', error, { 
        profileId: id, 
        availability 
      });
      throw AuthErrorFactory.databaseError('Failed to update availability', error);
    }
  }

  // Rating and Review Operations

  /**
   * Update profile rating
   * For BuildHive rating system
   */
  async updateRating(id: string, newRating: {
    overall: number;
    breakdown: {
      quality: number;
      communication: number;
      timeliness: number;
      professionalism: number;
      value: number;
    };
  }): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      // Validate rating values
      if (newRating.overall < 1 || newRating.overall > 5) {
        throw AuthErrorFactory.invalidInput('Overall rating must be between 1 and 5');
      }

      const profile = await this.model
        .findById(id)
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      // Calculate new average ratings
      const currentRatings = profile.ratings || { overall: 0, totalReviews: 0, breakdown: {} };
      const totalReviews = currentRatings.totalReviews + 1;
      
      const updatedRatings = {
        overall: ((currentRatings.overall * currentRatings.totalReviews) + newRating.overall) / totalReviews,
        totalReviews,
        breakdown: {
          quality: ((currentRatings.breakdown?.quality || 0) * currentRatings.totalReviews + newRating.breakdown.quality) / totalReviews,
          communication: ((currentRatings.breakdown?.communication || 0) * currentRatings.totalReviews + newRating.breakdown.communication) / totalReviews,
          timeliness: ((currentRatings.breakdown?.timeliness || 0) * currentRatings.totalReviews + newRating.breakdown.timeliness) / totalReviews,
          professionalism: ((currentRatings.breakdown?.professionalism || 0) * currentRatings.totalReviews + newRating.breakdown.professionalism) / totalReviews,
          value: ((currentRatings.breakdown?.value || 0) * currentRatings.totalReviews + newRating.breakdown.value) / totalReviews,
        },
        lastUpdated: new Date(),
      };

      await this.model
        .findByIdAndUpdate(id, { $set: { ratings: updatedRatings } })
        .exec();

      this.logger.info('Rating updated', {
        profileId: id,
        userId: profile.userId,
        newOverallRating: updatedRatings.overall,
        totalReviews,
      });

      // Emit rating update event
      await this.emitProfileEvent('profile.rating_updated', profile, { 
        newRating: updatedRatings 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update rating', error, { 
        profileId: id, 
        newRating 
      });
      throw AuthErrorFactory.databaseError('Failed to update rating', error);
    }
  }

  // Location-based Operations

  /**
   * Find profiles by location
   * For BuildHive location-based job matching
   */
  async findProfilesByLocation(state: string, suburb?: string, radius?: number): Promise<IProfileDocument[]> {
    try {
      if (!this.isValidAustralianState(state)) {
        throw AuthErrorFactory.invalidInput('Invalid Australian state');
      }

      const query: any = {
        deletedAt: { $exists: false },
        'address.state': state.toUpperCase(),
      };

      if (suburb) {
        query['address.suburb'] = new RegExp(suburb, 'i');
      }

      const profiles = await this.model
        .find(query)
        .populate('userId', 'username email status')
        .sort({ 'ratings.overall': -1 })
        .lean()
        .exec();

      this.logger.debug('Profiles found by location', {
        state,
        suburb,
        count: profiles.length,
      });

      return profiles as IProfileDocument[];
    } catch (error) {
      this.logger.error('Failed to find profiles by location', error, { state, suburb });
      throw AuthErrorFactory.databaseError('Failed to find profiles by location', error);
    }
  }

  /**
   * Find profiles within service radius
   * For geolocation-based matching
   */
  async findProfilesInServiceRadius(latitude: number, longitude: number, maxRadius: number): Promise<IProfileDocument[]> {
    try {
      const profiles = await this.model
        .find({
          deletedAt: { $exists: false },
          'address.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude]
              },
              $maxDistance: maxRadius * 1000 // Convert km to meters
            }
          }
        })
        .populate('userId', 'username email status')
        .sort({ 'ratings.overall': -1 })
        .lean()
        .exec();

      this.logger.debug('Profiles found in service radius', {
        latitude,
        longitude,
        maxRadius,
        count: profiles.length,
      });

      return profiles as IProfileDocument[];
    } catch (error) {
      this.logger.error('Failed to find profiles in service radius', error, { 
        latitude, 
        longitude, 
        maxRadius 
      });
      throw AuthErrorFactory.databaseError('Failed to find profiles in service radius', error);
    }
  }

  // Portfolio Operations

  /**
   * Add portfolio item
   * For tradie portfolio management
   */
  async addPortfolioItem(id: string, portfolioItem: any): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      const itemWithId = {
        ...portfolioItem,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      };

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { $push: { 'tradieInfo.portfolio': itemWithId } },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Portfolio item added', {
        profileId: id,
        userId: profile.userId,
        itemId: itemWithId._id,
        itemType: portfolioItem.type,
      });

      // Emit portfolio update event
      await this.emitProfileEvent('profile.portfolio_updated', profile, { 
        action: 'added',
        itemId: itemWithId._id 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to add portfolio item', error, { 
        profileId: id, 
        portfolioItem 
      });
      throw AuthErrorFactory.databaseError('Failed to add portfolio item', error);
    }
  }

  /**
   * Update portfolio item
   * For editing existing portfolio items
   */
  async updatePortfolioItem(id: string, itemId: string, updateData: any): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(itemId)) {
        throw AuthErrorFactory.invalidInput('Invalid ID format');
      }

      const profile = await this.model
        .findOneAndUpdate(
          { 
            _id: id,
            'tradieInfo.portfolio._id': itemId 
          },
          { 
            $set: { 
              'tradieInfo.portfolio.$.title': updateData.title,
              'tradieInfo.portfolio.$.description': updateData.description,
              'tradieInfo.portfolio.$.images': updateData.images,
              'tradieInfo.portfolio.$.updatedAt': new Date(),
            }
          },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Portfolio item updated', {
        profileId: id,
        userId: profile.userId,
        itemId,
      });

      // Emit portfolio update event
      await this.emitProfileEvent('profile.portfolio_updated', profile, { 
        action: 'updated',
        itemId 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update portfolio item', error, { 
        profileId: id, 
        itemId, 
        updateData 
      });
      throw AuthErrorFactory.databaseError('Failed to update portfolio item', error);
    }
  }

  /**
   * Remove portfolio item
   * For deleting portfolio items
   */
  async removePortfolioItem(id: string, itemId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(itemId)) {
        throw AuthErrorFactory.invalidInput('Invalid ID format');
      }

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { $pull: { 'tradieInfo.portfolio': { _id: itemId } } },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Portfolio item removed', {
        profileId: id,
        userId: profile.userId,
        itemId,
      });

      // Emit portfolio update event
      await this.emitProfileEvent('profile.portfolio_updated', profile, { 
        action: 'removed',
        itemId 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to remove portfolio item', error, { 
        profileId: id, 
        itemId 
      });
      throw AuthErrorFactory.databaseError('Failed to remove portfolio item', error);
    }
  }

  // Qualification Operations

  /**
   * Add qualification
   * For tradie qualification management
   */
  async addQualification(id: string, qualification: any): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AuthErrorFactory.invalidInput('Invalid profile ID format');
      }

      const qualificationWithId = {
        ...qualification,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        verified: false,
      };

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { $push: { 'tradieInfo.qualifications': qualificationWithId } },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Qualification added', {
        profileId: id,
        userId: profile.userId,
        qualificationId: qualificationWithId._id,
        type: qualification.type,
      });

      // Emit qualification update event
      await this.emitProfileEvent('profile.qualification_updated', profile, { 
        action: 'added',
        qualificationId: qualificationWithId._id 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to add qualification', error, { 
        profileId: id, 
        qualification 
      });
      throw AuthErrorFactory.databaseError('Failed to add qualification', error);
    }
  }

  /**
   * Update qualification
   * For editing existing qualifications
   */
  async updateQualification(id: string, qualificationId: string, updateData: any): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(qualificationId)) {
        throw AuthErrorFactory.invalidInput('Invalid ID format');
      }

      const profile = await this.model
        .findOneAndUpdate(
          { 
            _id: id,
            'tradieInfo.qualifications._id': qualificationId 
          },
          { 
            $set: { 
              'tradieInfo.qualifications.$.name': updateData.name,
              'tradieInfo.qualifications.$.issuer': updateData.issuer,
              'tradieInfo.qualifications.$.dateObtained': updateData.dateObtained,
              'tradieInfo.qualifications.$.expiryDate': updateData.expiryDate,
              'tradieInfo.qualifications.$.certificateNumber': updateData.certificateNumber,
              'tradieInfo.qualifications.$.updatedAt': new Date(),
            }
          },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Qualification updated', {
        profileId: id,
        userId: profile.userId,
        qualificationId,
      });

      // Emit qualification update event
      await this.emitProfileEvent('profile.qualification_updated', profile, { 
        action: 'updated',
        qualificationId 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to update qualification', error, { 
        profileId: id, 
        qualificationId, 
        updateData 
      });
      throw AuthErrorFactory.databaseError('Failed to update qualification', error);
    }
  }

  /**
   * Remove qualification
   * For deleting qualifications
   */
  async removeQualification(id: string, qualificationId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(qualificationId)) {
        throw AuthErrorFactory.invalidInput('Invalid ID format');
      }

      const profile = await this.model
        .findByIdAndUpdate(
          id,
          { $pull: { 'tradieInfo.qualifications': { _id: qualificationId } } },
          { new: true }
        )
        .exec();

      if (!profile) {
        throw AuthErrorFactory.profileNotFound();
      }

      this.logger.info('Qualification removed', {
        profileId: id,
        userId: profile.userId,
        qualificationId,
      });

      // Emit qualification update event
      await this.emitProfileEvent('profile.qualification_updated', profile, { 
        action: 'removed',
        qualificationId 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to remove qualification', error, { 
        profileId: id, 
        qualificationId 
      });
      throw AuthErrorFactory.databaseError('Failed to remove qualification', error);
    }
  }

  /**
 * Search profiles with advanced filtering and facets
 * Core functionality for BuildHive marketplace search
 */
async searchProfiles(query: {
  searchTerm?: string;
  serviceCategories?: string[];
  location?: string;
  minRating?: number;
  maxHourlyRate?: number;
  availability?: string;
  verified?: boolean;
}, options?: PaginationOptions): Promise<{
  profiles: IProfileDocument[];
  total: number;
  facets: {
    serviceCategories: { category: string; count: number }[];
    locations: { location: string; count: number }[];
    ratingRanges: { range: string; count: number }[];
  };
}> {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Build base query
    const baseQuery: FilterQuery<IProfileDocument> = {
      deletedAt: { $exists: false },
    };

    // Search term filter (name, business name, specializations)
    if (query.searchTerm) {
      const searchRegex = new RegExp(query.searchTerm, 'i');
      baseQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { displayName: searchRegex },
        { 'businessInfo.businessName': searchRegex },
        { 'businessInfo.tradingName': searchRegex },
        { 'tradieInfo.specializations': { $in: [searchRegex] } },
      ];
    }

    // Service categories filter
    if (query.serviceCategories && query.serviceCategories.length > 0) {
      baseQuery['tradieInfo.serviceCategories'] = { $in: query.serviceCategories };
    }

    // Location filter
    if (query.location) {
      const locationRegex = new RegExp(query.location, 'i');
      baseQuery.$or = baseQuery.$or || [];
      baseQuery.$or.push(
        { 'address.state': locationRegex },
        { 'address.suburb': locationRegex },
        { 'address.postcode': locationRegex }
      );
    }

    // Rating filter
    if (query.minRating) {
      baseQuery['ratings.overall'] = { $gte: query.minRating };
    }

    // Hourly rate filter
    if (query.maxHourlyRate) {
      baseQuery['tradieInfo.hourlyRate.max'] = { $lte: query.maxHourlyRate };
    }

    // Availability filter
    if (query.availability) {
      baseQuery['tradieInfo.availability.status'] = query.availability;
    }

    // Verification filter
    if (query.verified === true) {
      baseQuery.verificationStatus = VERIFICATION_STATUS.VERIFIED;
    }

    // Execute search with pagination
    const [profiles, total, facets] = await Promise.all([
      this.model
        .find(baseQuery)
        .populate('userId', 'username email status lastLogin')
        .sort({ 
          'ratings.overall': -1, 
          'tradieInfo.hourlyRate.min': 1,
          updatedAt: -1 
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(baseQuery),
      this.generateSearchFacets(baseQuery)
    ]);

    this.logger.info('Profile search completed', {
      query,
      resultsCount: profiles.length,
      totalResults: total,
      page,
      limit,
    });

    return {
      profiles: profiles as IProfileDocument[],
      total,
      facets,
    };
  } catch (error) {
    this.logger.error('Profile search failed', error, { query, options });
    throw AuthErrorFactory.databaseError('Profile search failed', error);
  }
}

/**
 * Get comprehensive profile statistics
 * For admin dashboard and analytics
 */
async getProfileStatistics(): Promise<{
  totalProfiles: number;
  profilesByRole: Record<UserRole, number>;
  verificationStats: Record<string, number>;
  averageRatings: Record<string, number>;
  serviceDistribution: { category: string; count: number }[];
  locationDistribution: { state: string; count: number }[];
}> {
  try {
    const [
      totalProfiles,
      profilesByRole,
      verificationStats,
      averageRatings,
      serviceDistribution,
      locationDistribution
    ] = await Promise.all([
      // Total profiles count
      this.model.countDocuments({ deletedAt: { $exists: false } }),

      // Profiles by role
      this.model.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),

      // Verification statistics
      this.model.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
      ]),

      // Average ratings by role
      this.model.aggregate([
        { 
          $match: { 
            deletedAt: { $exists: false },
            'ratings.overall': { $exists: true, $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$role',
            averageRating: { $avg: '$ratings.overall' },
            totalRated: { $sum: 1 }
          }
        }
      ]),

      // Service category distribution
      this.model.aggregate([
        { 
          $match: { 
            deletedAt: { $exists: false },
            role: USER_ROLES.TRADIE,
            'tradieInfo.serviceCategories': { $exists: true }
          }
        },
        { $unwind: '$tradieInfo.serviceCategories' },
        { $group: { _id: '$tradieInfo.serviceCategories', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Location distribution
      this.model.aggregate([
        { 
          $match: { 
            deletedAt: { $exists: false },
            'address.state': { $exists: true }
          }
        },
        { $group: { _id: '$address.state', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    // Transform aggregation results to expected format
    const profilesByRoleMap: Record<UserRole, number> = {
      [USER_ROLES.CLIENT]: 0,
      [USER_ROLES.TRADIE]: 0,
      [USER_ROLES.ENTERPRISE]: 0,
    };

    profilesByRole.forEach(item => {
      if (item._id in profilesByRoleMap) {
        profilesByRoleMap[item._id as UserRole] = item.count;
      }
    });

    const verificationStatsMap: Record<string, number> = {};
    verificationStats.forEach(item => {
      verificationStatsMap[item._id] = item.count;
    });

    const averageRatingsMap: Record<string, number> = {};
    averageRatings.forEach(item => {
      averageRatingsMap[item._id] = Math.round(item.averageRating * 100) / 100;
    });

    const serviceDistributionArray = serviceDistribution.map(item => ({
      category: item._id,
      count: item.count
    }));

    const locationDistributionArray = locationDistribution.map(item => ({
      state: item._id,
      count: item.count
    }));

    const statistics = {
      totalProfiles,
      profilesByRole: profilesByRoleMap,
      verificationStats: verificationStatsMap,
      averageRatings: averageRatingsMap,
      serviceDistribution: serviceDistributionArray,
      locationDistribution: locationDistributionArray,
    };

    this.logger.info('Profile statistics generated', {
      totalProfiles,
      profilesByRole: profilesByRoleMap,
      verificationStats: verificationStatsMap,
    });

    return statistics;
  } catch (error) {
    this.logger.error('Failed to generate profile statistics', error);
    throw AuthErrorFactory.databaseError('Failed to generate profile statistics', error);
  }
}

  // Advanced Search with Facets

  /**
   * Generate search facets for filtering
   * For BuildHive marketplace filtering
   */
  private async generateSearchFacets(baseQuery: FilterQuery<IProfileDocument>): Promise<{
    serviceCategories: { category: string; count: number }[];
    locations: { location: string; count: number }[];
    ratingRanges: { range: string; count: number }[];
  }> {
    try {
      const [serviceCategories, locations, ratingRanges] = await Promise.all([
        // Service categories facet
        this.model.aggregate([
          { $match: baseQuery },
          { $unwind: '$tradieInfo.serviceCategories' },
          { $group: { _id: '$tradieInfo.serviceCategories', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]),

        // Locations facet
        this.model.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$address.state', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Rating ranges facet
        this.model.aggregate([
          { $match: { ...baseQuery, 'ratings.overall': { $exists: true } } },
          {
            $bucket: {
              groupBy: '$ratings.overall',
              boundaries: [0, 2, 3, 4, 4.5, 5],
              default: 'No Rating',
              output: { count: { $sum: 1 } }
            }
          }
        ])
      ]);

      return {
        serviceCategories: serviceCategories.map(item => ({
          category: item._id,
          count: item.count
        })),
        locations: locations.map(item => ({
          location: item._id,
          count: item.count
        })),
        ratingRanges: ratingRanges.map(item => ({
          range: item._id === 'No Rating' ? 'No Rating' : `${item._id}+ stars`,
          count: item.count
        }))
      };
    } catch (error) {
      this.logger.error('Failed to generate search facets', error);
      return {
        serviceCategories: [],
        locations: [],
        ratingRanges: []
      };
    }
  }

  // Private Helper Methods

  /**
   * Sanitize profile update data
   */
  private sanitizeUpdateData(updateData: Partial<IProfileDocument>): Partial<IProfileDocument> {
    const sanitized = { ...updateData };
    
    // Remove fields that shouldn't be updated directly
    delete sanitized._id;
    delete sanitized.userId;
    delete sanitized.createdAt;
    delete sanitized.deletedAt;
    
    return sanitized;
  }

  /**
   * Validate ABN (Australian Business Number)
   */
  private isValidABN(abn: string): boolean {
    // Remove spaces and validate format
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return false;

    // ABN checksum validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleanABN.split('').map(Number);
    digits[0] -= 1; // Subtract 1 from first digit

    const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
    return sum % 89 === 0;
  }

  /**
   * Validate Australian state codes
   */
  private isValidAustralianState(state: string): boolean {
    const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
    return validStates.includes(state.toUpperCase());
  }

  /**
   * Validate profile data based on role
   */
  private validateProfileData(profileData: Partial<IProfileDocument>): void {
    if (!profileData.userId) {
      throw AuthErrorFactory.invalidInput('User ID is required');
    }

    if (!profileData.role || !Object.values(USER_ROLES).includes(profileData.role)) {
      throw AuthErrorFactory.invalidInput('Valid user role is required');
    }

    // Role-specific validation
    if (profileData.role === USER_ROLES.TRADIE) {
      if (!profileData.firstName || !profileData.lastName) {
        throw AuthErrorFactory.invalidInput('First name and last name are required for tradies');
      }
    }

    if (profileData.role === USER_ROLES.ENTERPRISE) {
      if (!profileData.businessInfo?.companyName) {
        throw AuthErrorFactory.invalidInput('Company name is required for enterprise profiles');
      }
    }
  }

  /**
   * Emit profile events for event-driven architecture
   */
  private async emitProfileEvent(eventType: string, profile: IProfileDocument | null, metadata?: any): Promise<void> {
    try {
      const eventData = {
        eventType,
        timestamp: new Date(),
        profileId: profile?._id,
        userId: profile?.userId,
        role: profile?.role,
        metadata,
      };

      // Emit to Redis pub/sub for real-time notifications
      await this.publishEvent(eventType, eventData);
      
      this.logger.debug('Profile event emitted', eventData);
    } catch (error) {
      this.logger.error('Failed to emit profile event', error, { eventType, profileId: profile?._id });
      // Don't throw error to prevent breaking main operation
    }
  }

  /**
   * Publish event to Redis pub/sub
   */
  private async publishEvent(eventType: string, eventData: any): Promise<void> {
    // This will be implemented with Redis client
    if (this.eventPublisher) {
      await this.eventPublisher.publish(`profile.${eventType}`, eventData);
    }
  }

  // Event publisher dependency injection (Dependency Inversion Principle)
  private eventPublisher?: {
    publish(channel: string, data: any): Promise<void>;
  };

  /**
   * Set event publisher for dependency injection
   */
  setEventPublisher(publisher: { publish(channel: string, data: any): Promise<void> }): void {
    this.eventPublisher = publisher;
  }
}

// Export repository instance and interface
export const profileRepository = new ProfileRepository();
export default profileRepository;
