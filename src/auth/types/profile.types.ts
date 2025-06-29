import type { BaseApiResponse, PaginatedApiResponse, BaseProfile, UserRole, VerificationStatus, Address, BusinessInfo, ContactInfo, BaseQueryParams } from '../../shared/types';
import type { PlatformType } from './auth.types';

export type ServiceCategory = 'electrical' | 'plumbing' | 'carpentry' | 'painting' | 'roofing' | 'landscaping' | 'tiling' | 'flooring' | 'handyman' | 'cleaning' | 'hvac' | 'security' | 'other';
export type AvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'vacation';
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export type BusinessType = 'sole_trader' | 'partnership' | 'company' | 'trust';
export type PropertyType = 'residential' | 'commercial' | 'industrial';
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

export interface ProfileAddress {
  street: string;
  suburb: string;
  state: AustralianState;
  postcode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ProfileBusinessInfo {
  businessName?: string;
  abn?: string;
  acn?: string;
  tradingName?: string;
  businessType?: BusinessType;
  website?: string;
  description?: string;
  yearEstablished?: number;
  employeeCount?: number;
  servicesOffered?: string[];
}

export interface ProfileMedia {
  avatar?: string;
  coverImage?: string;
  gallery: Array<{
    url: string;
    caption?: string;
    type: 'image' | 'video';
    uploadedAt: Date;
  }>;
}

export interface VerificationDocument {
  type: 'id' | 'license' | 'insurance' | 'qualification' | 'abn' | 'other';
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface ProfileRatings {
  overall: number;
  totalReviews: number;
  breakdown: {
    quality: number;
    communication: number;
    timeliness: number;
    professionalism: number;
    value: number;
  };
  recentReviews: Array<{
    reviewId: string;
    rating: number;
    comment: string;
    reviewerName: string;
    reviewDate: Date;
    jobCategory: ServiceCategory;
    verified: boolean;
  }>;
}

export interface ProfileStatistics {
  profileViews: number;
  jobsCompleted: number;
  jobsInProgress: number;
  responseTime: number;
  responseRate: number;
  repeatClientRate: number;
  onTimeCompletionRate: number;
  lastActiveDate: Date;
  joinDate: Date;
}

export interface ProfileCompletion {
  percentage: number;
  missingFields: string[];
  lastCalculated: Date;
}

export interface QualityScore {
  score: number;
  factors: {
    profileCompleteness: number;
    verificationStatus: number;
    reviewRating: number;
    responseTime: number;
    jobCompletionRate: number;
  };
  lastCalculated: Date;
}

export interface TradieQualification {
  name: string;
  issuer: string;
  licenseNumber?: string;
  issueDate: Date;
  expiryDate?: Date;
  verified: boolean;
  documentUrl?: string;
}

export interface TradieInsurance {
  publicLiability: {
    provider: string;
    policyNumber: string;
    coverageAmount: number;
    expiryDate: Date;
    documentUrl?: string;
  };
  workersCompensation?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    documentUrl?: string;
  };
}

export interface TradieAvailability {
  status: AvailabilityStatus;
  workingHours: {
    monday: { start: string; end: string; available: boolean };
    tuesday: { start: string; end: string; available: boolean };
    wednesday: { start: string; end: string; available: boolean };
    thursday: { start: string; end: string; available: boolean };
    friday: { start: string; end: string; available: boolean };
    saturday: { start: string; end: string; available: boolean };
    sunday: { start: string; end: string; available: boolean };
  };
  serviceRadius: number;
  travelFee?: number;
  emergencyAvailable: boolean;
  weekendAvailable: boolean;
}

export interface QuotingPreferences {
  providesQuotes: boolean;
  quoteValidityDays: number;
  minimumJobValue?: number;
  calloutFee?: number;
  materialMarkup?: number;
}

export interface PortfolioItem {
  title: string;
  description: string;
  images: string[];
  completedDate: Date;
  clientTestimonial?: string;
  tags: string[];
}

export interface ClientCommunicationPreferences {
  receiveQuotes: boolean;
  receiveUpdates: boolean;
  receiveMarketing: boolean;
  preferredTimeToContact: string;
}

export interface ClientJobHistory {
  jobId: string;
  title: string;
  category: ServiceCategory;
  completedDate: Date;
  rating?: number;
  review?: string;
}

export interface EnterpriseTeamStructure {
  totalEmployees: number;
  activeFieldWorkers: number;
  adminStaff: number;
  supervisors: number;
}

export interface EnterpriseServiceArea {
  suburb: string;
  postcode: string;
  state: AustralianState;
  priority: 'primary' | 'secondary';
}

export interface EnterpriseCertification {
  name: string;
  issuer: string;
  certificateNumber: string;
  issueDate: Date;
  expiryDate?: Date;
  documentUrl?: string;
  verified: boolean;
}

export interface EnterpriseOperationalPreferences {
  minimumJobValue: number;
  maximumConcurrentJobs: number;
  workingRadius: number;
  emergencyServices: boolean;
  weekendOperations: boolean;
  afterHoursAvailable: boolean;
}

export interface EnterpriseClientPortfolio {
  clientName: string;
  projectType: string;
  projectValue?: number;
  completionDate: Date;
  testimonial?: string;
  images?: string[];
  isPublic: boolean;
}

export interface CreateProfileRequest {
  userId: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  alternatePhone?: string;
  email?: string;
  preferredContact: 'email' | 'phone' | 'sms' | 'app';
  address?: ProfileAddress;
  businessInfo?: ProfileBusinessInfo;
  tradieInfo?: CreateTradieProfileRequest;
  clientInfo?: CreateClientProfileRequest;
  enterpriseInfo?: CreateEnterpriseProfileRequest;
}

export interface CreateTradieProfileRequest {
  serviceCategories: ServiceCategory[];
  specializations: string[];
  hourlyRate?: {
    min: number;
    max: number;
    currency: string;
  };
  qualifications: TradieQualification[];
  insurance?: TradieInsurance;
  availability: TradieAvailability;
  yearsExperience: number;
  toolsAndEquipment?: string[];
  vehicleType?: string;
  quotingPreferences: QuotingPreferences;
}

export interface CreateClientProfileRequest {
  propertyType?: PropertyType;
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };
  communicationPreferences: ClientCommunicationPreferences;
}

export interface CreateEnterpriseProfileRequest {
  companySize: CompanySize;
  industry: string[];
  headquarters: ProfileAddress;
  teamStructure: EnterpriseTeamStructure;
  serviceAreas: EnterpriseServiceArea[];
  certifications: EnterpriseCertification[];
  operationalPreferences: EnterpriseOperationalPreferences;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  alternatePhone?: string;
  email?: string;
  preferredContact?: 'email' | 'phone' | 'sms' | 'app';
  address?: Partial<ProfileAddress>;
  businessInfo?: Partial<ProfileBusinessInfo>;
  updatedBy?: string;
}

export interface ProfileQueryParams extends BaseQueryParams {
  role?: UserRole;
  verificationStatus?: VerificationStatus;
  serviceCategories?: ServiceCategory[];
  state?: AustralianState;
  suburb?: string;
  availability?: AvailabilityStatus;
  minRating?: number;
  maxHourlyRate?: number;
  verified?: boolean;
  hasInsurance?: boolean;
  yearsExperience?: number;
  serviceRadius?: number;
}

export interface ProfileData extends BaseProfile {
  displayName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  alternatePhone?: string;
  preferredContact: 'email' | 'phone' | 'sms' | 'app';
  address?: ProfileAddress;
  media: ProfileMedia;
  businessInfo?: ProfileBusinessInfo;
  verificationDocuments: VerificationDocument[];
  ratings: ProfileRatings;
  statistics: ProfileStatistics;
  profileCompletion: ProfileCompletion;
  qualityScore: QualityScore;
}

export interface TradieProfile extends ProfileData {
  role: 'tradie';
  tradieInfo: {
    serviceCategories: ServiceCategory[];
    specializations: string[];
    hourlyRate?: {
      min: number;
      max: number;
      currency: string;
    };
    qualifications: TradieQualification[];
    insurance?: TradieInsurance;
    availability: TradieAvailability;
    portfolio: PortfolioItem[];
    yearsExperience: number;
    completedJobs: number;
    toolsAndEquipment?: string[];
    vehicleType?: string;
    quotingPreferences: QuotingPreferences;
  };
}

export interface ClientProfile extends ProfileData {
  role: 'client';
  clientInfo: {
    propertyType?: PropertyType;
    jobHistory: ClientJobHistory[];
    preferredTradies: string[];
    budgetRange?: {
      min: number;
      max: number;
      currency: string;
    };
    communicationPreferences: ClientCommunicationPreferences;
  };
}

export interface EnterpriseProfile extends ProfileData {
  role: 'enterprise';
  enterpriseInfo: {
    companySize: CompanySize;
    industry: string[];
    headquarters: ProfileAddress;
    teamStructure: EnterpriseTeamStructure;
    serviceAreas: EnterpriseServiceArea[];
    certifications: EnterpriseCertification[];
    operationalPreferences: EnterpriseOperationalPreferences;
    clientPortfolio: EnterpriseClientPortfolio[];
  };
}

export interface ProfileResponse extends BaseApiResponse {
  success: true;
  data: TradieProfile | ClientProfile | EnterpriseProfile;
}

export interface ProfileListResponse extends PaginatedApiResponse<ProfileData> {
  filters?: ProfileQueryParams;
  facets?: {
    serviceCategories: { category: ServiceCategory; count: number }[];
    locations: { state: AustralianState; count: number }[];
    ratingRanges: { range: string; count: number }[];
  };
}

export type ProfileType = TradieProfile | ClientProfile | EnterpriseProfile;
export type CreateProfileRequestType = CreateTradieProfileRequest | CreateClientProfileRequest | CreateEnterpriseProfileRequest;
export type ProfileRequestType = CreateProfileRequest | UpdateProfileRequest;
export type ProfileResponseType = ProfileResponse | ProfileListResponse;
