import { Schema, model } from 'mongoose';
import { USER_ROLES, VERIFICATION_STATUS, SERVICE_CATEGORIES, AVAILABILITY_STATUS } from '../../config/auth';
import { buildHiveLogger } from '../../shared';
import type { BaseDocument, UserRole, VerificationStatus } from '../../shared/types';
import type { ServiceCategory, AvailabilityStatus } from '../types/profile.types';

export interface IProfileDocument extends BaseDocument {
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
  address?: {
    street: string;
    suburb: string;
    state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
    postcode: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  avatar?: string;
  coverImage?: string;
  gallery?: Array<{
    url: string;
    caption?: string;
    type: 'image' | 'video';
    uploadedAt: Date;
  }>;
  verificationStatus: VerificationStatus;
  verificationDocuments?: Array<{
    type: 'id' | 'license' | 'insurance' | 'qualification' | 'abn' | 'other';
    url: string;
    status: 'pending' | 'approved' | 'rejected';
    uploadedAt: Date;
    reviewedAt?: Date;
    reviewNotes?: string;
  }>;
  businessInfo?: {
    businessName?: string;
    abn?: string;
    acn?: string;
    tradingName?: string;
    businessType?: 'sole_trader' | 'partnership' | 'company' | 'trust';
    website?: string;
    description?: string;
    yearEstablished?: number;
    employeeCount?: number;
    servicesOffered?: string[];
  };
  tradieInfo?: {
    serviceCategories: ServiceCategory[];
    specializations: string[];
    hourlyRate?: {
      min: number;
      max: number;
      currency: string;
    };
    qualifications: Array<{
      name: string;
      issuer: string;
      licenseNumber?: string;
      issueDate: Date;
      expiryDate?: Date;
      verified: boolean;
      documentUrl?: string;
    }>;
    insurance?: {
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
    };
    availability: {
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
    };
    portfolio: Array<{
      title: string;
      description: string;
      images: string[];
      completedDate: Date;
      clientTestimonial?: string;
      tags: string[];
    }>;
    yearsExperience: number;
    completedJobs: number;
    toolsAndEquipment?: string[];
    vehicleType?: string;
    quotingPreferences: {
      providesQuotes: boolean;
      quoteValidityDays: number;
      minimumJobValue?: number;
      calloutFee?: number;
      materialMarkup?: number;
    };
  };
  clientInfo?: {
    propertyType?: 'residential' | 'commercial' | 'industrial';
    jobHistory: Array<{
      jobId: string;
      title: string;
      category: ServiceCategory;
      completedDate: Date;
      rating?: number;
      review?: string;
    }>;
    preferredTradies: string[];
    budgetRange?: {
      min: number;
      max: number;
      currency: string;
    };
    communicationPreferences: {
      receiveQuotes: boolean;
      receiveUpdates: boolean;
      receiveMarketing: boolean;
      preferredTimeToContact: string;
    };
  };
  enterpriseInfo?: {
    companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    industry: string[];
    headquarters: {
      street: string;
      suburb: string;
      state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
      postcode: string;
    };
    teamStructure: {
      totalEmployees: number;
      activeFieldWorkers: number;
      adminStaff: number;
      supervisors: number;
    };
    serviceAreas: Array<{
      suburb: string;
      postcode: string;
      state: string;
      priority: 'primary' | 'secondary';
    }>;
    certifications: Array<{
      name: string;
      issuer: string;
      certificateNumber: string;
      issueDate: Date;
      expiryDate?: Date;
      documentUrl?: string;
      verified: boolean;
    }>;
    financialInfo?: {
      annualRevenue?: string;
      creditRating?: string;
      paymentTerms: string;
      preferredPaymentMethods: string[];
    };
    operationalPreferences: {
      minimumJobValue: number;
      maximumConcurrentJobs: number;
      workingRadius: number;
      emergencyServices: boolean;
      weekendOperations: boolean;
      after_hours_available: boolean;
    };
    clientPortfolio: Array<{
      clientName: string;
      projectType: string;
      projectValue?: number;
      completionDate: Date;
      testimonial?: string;
      images?: string[];
      isPublic: boolean;
    }>;
  };
  ratings: {
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
  };
  statistics: {
    profileViews: number;
    jobsCompleted: number;
    jobsInProgress: number;
    responseTime: number;
    responseRate: number;
    repeatClientRate: number;
    onTimeCompletionRate: number;
    lastActiveDate: Date;
    joinDate: Date;
  };
  preferences: {
    notifications: {
      email: {
        newJobs: boolean;
        jobUpdates: boolean;
        messages: boolean;
        reviews: boolean;
        marketing: boolean;
      };
      sms: {
        urgentJobs: boolean;
        jobReminders: boolean;
        paymentAlerts: boolean;
      };
      push: {
        newJobs: boolean;
        messages: boolean;
        jobUpdates: boolean;
        reviews: boolean;
      };
    };
    privacy: {
      showPhone: boolean;
      showEmail: boolean;
      showAddress: boolean;
      showRates: boolean;
      allowDirectContact: boolean;
      profileVisibility: 'public' | 'registered_users' | 'private';
    };
    jobPreferences: {
      autoAcceptJobs: boolean;
      jobValueRange: {
        min: number;
        max: number;
      };
      preferredJobTypes: ServiceCategory[];
      blacklistedClients: string[];
      workingDistance: number;
      requiresDeposit: boolean;
      depositPercentage?: number;
    };
  };
  socialLinks?: {
    website?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  compliance: {
    termsAccepted: boolean;
    termsAcceptedDate: Date;
    privacyPolicyAccepted: boolean;
    privacyPolicyAcceptedDate: Date;
    marketingConsent: boolean;
    dataRetentionConsent: boolean;
    lastPolicyUpdate?: Date;
  };
  profileCompletion: {
    percentage: number;
    missingFields: string[];
    lastCalculated: Date;
  };
  qualityScore: {
    score: number;
    factors: {
      profileCompleteness: number;
      verificationStatus: number;
      reviewRating: number;
      responseTime: number;
      jobCompletionRate: number;
    };
    lastCalculated: Date;
  };
  calculateProfileCompletion(): number;
  calculateQualityScore(): number;
  isProfileComplete(): boolean;
  canReceiveJobs(): boolean;
  updateStatistics(): Promise<void>;
  addPortfolioItem(item: any): Promise<void>;
  updateAvailability(status: AvailabilityStatus): Promise<void>;
  addQualification(qualification: any): Promise<void>;
  getServiceRadius(): number;
  isWithinServiceArea(location: { latitude: number; longitude: number }): boolean;
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
}

const profileSchema = new Schema<IProfileDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
    index: true,
  },
  role: {
    type: String,
    enum: {
      values: Object.values(USER_ROLES),
      message: 'Role must be one of: {VALUES}'
    },
    required: [true, 'User role is required'],
    index: true,
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters'],
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters'],
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value: Date) {
        if (!value) return true;
        const age = (new Date().getTime() - value.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 16 && age <= 100;
      },
      message: 'Age must be between 16 and 100 years'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
  },
  alternatePhone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid alternate phone number'],
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address'
    ],
  },
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'sms', 'app'],
    default: 'app',
  },

  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters'],
    },
    suburb: {
      type: String,
      trim: true,
      maxlength: [100, 'Suburb cannot exceed 100 characters'],
    },
    state: {
      type: String,
      enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
    },
    postcode: {
      type: String,
      trim: true,
      match: [/^\d{4}$/, 'Please provide a valid Australian postcode'],
    },
    country: {
      type: String,
      default: 'Australia',
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
  },
  avatar: {
    type: String,
    trim: true,
  },
  coverImage: {
    type: String,
    trim: true,
  },
  gallery: [{
    url: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [200, 'Caption cannot exceed 200 characters'],
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  verificationStatus: {
    type: String,
    enum: {
      values: Object.values(VERIFICATION_STATUS),
      message: 'Verification status must be one of: {VALUES}'
    },
    default: VERIFICATION_STATUS.PENDING,
    index: true,
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['id', 'license', 'insurance', 'qualification', 'abn', 'other'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: Date,
    reviewNotes: {
      type: String,
      trim: true,
    },
  }],
  businessInfo: {
    businessName: {
      type: String,
      trim: true,
      maxlength: [200, 'Business name cannot exceed 200 characters'],
    },
    abn: {
      type: String,
      trim: true,
      match: [/^\d{11}$/, 'ABN must be 11 digits'],
      sparse: true,
    },
    acn: {
      type: String,
      trim: true,
      match: [/^\d{9}$/, 'ACN must be 9 digits'],
      sparse: true,
    },
    tradingName: {
      type: String,
      trim: true,
      maxlength: [200, 'Trading name cannot exceed 200 characters'],
    },
    businessType: {
      type: String,
      enum: ['sole_trader', 'partnership', 'company', 'trust'],
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please provide a valid website URL'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    yearEstablished: {
      type: Number,
      min: [1900, 'Year established cannot be before 1900'],
      max: [new Date().getFullYear(), 'Year established cannot be in the future'],
    },
    employeeCount: {
      type: Number,
      min: [1, 'Employee count must be at least 1'],
    },
    servicesOffered: [{
      type: String,
      trim: true,
    }],
  },
  tradieInfo: {
    serviceCategories: [{
      type: String,
      enum: Object.values(SERVICE_CATEGORIES),
    }],
    specializations: [{
      type: String,
      trim: true,
    }],
    hourlyRate: {
      min: {
        type: Number,
        min: [0, 'Minimum rate cannot be negative'],
      },
      max: {
        type: Number,
        min: [0, 'Maximum rate cannot be negative'],
      },
      currency: {
        type: String,
        default: 'AUD',
      },
    },
    qualifications: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      issuer: {
        type: String,
        required: true,
        trim: true,
      },
      licenseNumber: {
        type: String,
        trim: true,
      },
      issueDate: {
        type: Date,
        required: true,
      },
      expiryDate: Date,
      verified: {
        type: Boolean,
        default: false,
      },
      documentUrl: {
        type: String,
        trim: true,
      },
    }],
    insurance: {
      publicLiability: {
        provider: String,
        policyNumber: String,
        coverageAmount: Number,
        expiryDate: Date,
        documentUrl: String,
      },
      workersCompensation: {
        provider: String,
        policyNumber: String,
        expiryDate: Date,
        documentUrl: String,
      },
    },
    availability: {
      status: {
        type: String,
        enum: Object.values(AVAILABILITY_STATUS),
        default: AVAILABILITY_STATUS.AVAILABLE,
      },
      workingHours: {
        monday: { start: String, end: String, available: { type: Boolean, default: true } },
        tuesday: { start: String, end: String, available: { type: Boolean, default: true } },
        wednesday: { start: String, end: String, available: { type: Boolean, default: true } },
        thursday: { start: String, end: String, available: { type: Boolean, default: true } },
        friday: { start: String, end: String, available: { type: Boolean, default: true } },
        saturday: { start: String, end: String, available: { type: Boolean, default: false } },
        sunday: { start: String, end: String, available: { type: Boolean, default: false } },
      },
      serviceRadius: {
        type: Number,
        default: 50,
        min: [0, 'Service radius cannot be negative'],
      },
      travelFee: {
        type: Number,
        min: [0, 'Travel fee cannot be negative'],
      },
      emergencyAvailable: {
        type: Boolean,
        default: false,
      },
      weekendAvailable: {
        type: Boolean,
        default: false,
      },
    },
    portfolio: [{
      title: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        required: true,
        trim: true,
      },
      images: [String],
      completedDate: {
        type: Date,
        required: true,
      },
      clientTestimonial: {
        type: String,
        trim: true,
      },
      tags: [String],
    }],
    yearsExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
      default: 0,
    },
    completedJobs: {
      type: Number,
      min: [0, 'Completed jobs cannot be negative'],
      default: 0,
    },
    toolsAndEquipment: [String],
    vehicleType: String,
    quotingPreferences: {
      providesQuotes: {
        type: Boolean,
        default: true,
      },
      quoteValidityDays: {
        type: Number,
        default: 30,
        min: [1, 'Quote validity must be at least 1 day'],
      },
      minimumJobValue: {
        type: Number,
        min: [0, 'Minimum job value cannot be negative'],
      },
      calloutFee: {
        type: Number,
        min: [0, 'Callout fee cannot be negative'],
      },
      materialMarkup: {
        type: Number,
        min: [0, 'Material markup cannot be negative'],
        max: [100, 'Material markup cannot exceed 100%'],
      },
    },
  },
  clientInfo: {
    propertyType: {
      type: String,
      enum: ['residential', 'commercial', 'industrial'],
    },
    jobHistory: [{
      jobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
      },
      title: String,
      category: {
        type: String,
        enum: Object.values(SERVICE_CATEGORIES),
      },
      completedDate: Date,
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      review: String,
    }],
    preferredTradies: [{
      type: Schema.Types.ObjectId,
      ref: 'Profile',
    }],
    budgetRange: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: 'AUD',
      },
    },
    communicationPreferences: {
      receiveQuotes: {
        type: Boolean,
        default: true,
      },
      receiveUpdates: {
        type: Boolean,
        default: true,
      },
      receiveMarketing: {
        type: Boolean,
        default: false,
      },
      preferredTimeToContact: {
        type: String,
        default: 'business_hours',
      },
    },
  },
  enterpriseInfo: {
    companySize: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
    },
    industry: [String],
    headquarters: {
      street: String,
      suburb: String,
      state: {
        type: String,
        enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
      },
      postcode: String,
    },
    teamStructure: {
      totalEmployees: Number,
      activeFieldWorkers: Number,
      adminStaff: Number,
      supervisors: Number,
    },
    serviceAreas: [{
      suburb: String,
      postcode: String,
      state: String,
      priority: {
        type: String,
        enum: ['primary', 'secondary'],
      },
    }],
    certifications: [{
      name: String,
      issuer: String,
      certificateNumber: String,
      issueDate: Date,
      expiryDate: Date,
      documentUrl: String,
      verified: {
        type: Boolean,
        default: false,
      },
    }],
    financialInfo: {
      annualRevenue: String,
      creditRating: String,
      paymentTerms: String,
      preferredPaymentMethods: [String],
    },
    operationalPreferences: {
      minimumJobValue: Number,
      maximumConcurrentJobs: Number,
      workingRadius: Number,
      emergencyServices: Boolean,
      weekendOperations: Boolean,
      after_hours_available: Boolean,
    },
    clientPortfolio: [{
      clientName: String,
      projectType: String,
      projectValue: Number,
      completionDate: Date,
      testimonial: String,
      images: [String],
      isPublic: {
        type: Boolean,
        default: false,
      },
    }],
  },

  ratings: {
    overall: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    breakdown: {
      quality: { type: Number, default: 0, min: 0, max: 5 },
      communication: { type: Number, default: 0, min: 0, max: 5 },
      timeliness: { type: Number, default: 0, min: 0, max: 5 },
      professionalism: { type: Number, default: 0, min: 0, max: 5 },
      value: { type: Number, default: 0, min: 0, max: 5 },
    },
    recentReviews: [{
      reviewId: String,
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      reviewerName: String,
      reviewDate: Date,
      jobCategory: {
        type: String,
        enum: Object.values(SERVICE_CATEGORIES),
      },
      verified: { type: Boolean, default: false },
    }],
  },
  statistics: {
    profileViews: { type: Number, default: 0 },
    jobsCompleted: { type: Number, default: 0 },
    jobsInProgress: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
    repeatClientRate: { type: Number, default: 0 },
    onTimeCompletionRate: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },
    joinDate: { type: Date, default: Date.now },
  },
  preferences: {
    notifications: {
      email: {
        newJobs: { type: Boolean, default: true },
        jobUpdates: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
      sms: {
        urgentJobs: { type: Boolean, default: true },
        jobReminders: { type: Boolean, default: true },
        paymentAlerts: { type: Boolean, default: true },
      },
      push: {
        newJobs: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        jobUpdates: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
      },
    },
    privacy: {
      showPhone: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
      showAddress: { type: Boolean, default: false },
      showRates: { type: Boolean, default: true },
      allowDirectContact: { type: Boolean, default: true },
      profileVisibility: {
        type: String,
        enum: ['public', 'registered_users', 'private'],
        default: 'public',
      },
    },
    jobPreferences: {
      autoAcceptJobs: { type: Boolean, default: false },
      jobValueRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 10000 },
      },
      preferredJobTypes: [{
        type: String,
        enum: Object.values(SERVICE_CATEGORIES),
      }],
      blacklistedClients: [String],
      workingDistance: { type: Number, default: 50 },
      requiresDeposit: { type: Boolean, default: false },
      depositPercentage: { type: Number, min: 0, max: 100 },
    },
  },
  socialLinks: {
    website: String,
    linkedin: String,
    facebook: String,
    instagram: String,
    youtube: String,
    tiktok: String,
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String,
  },
  compliance: {
    termsAccepted: { type: Boolean, required: true },
    termsAcceptedDate: { type: Date, required: true },
    privacyPolicyAccepted: { type: Boolean, required: true },
    privacyPolicyAcceptedDate: { type: Date, required: true },
    marketingConsent: { type: Boolean, default: false },
    dataRetentionConsent: { type: Boolean, default: true },
    lastPolicyUpdate: Date,
  },
  profileCompletion: {
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    missingFields: [String],
    lastCalculated: { type: Date, default: Date.now },
  },
  qualityScore: {
    score: { type: Number, default: 0, min: 0, max: 100 },
    factors: {
      profileCompleteness: { type: Number, default: 0 },
      verificationStatus: { type: Number, default: 0 },
      reviewRating: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      jobCompletionRate: { type: Number, default: 0 },
    },
    lastCalculated: { type: Date, default: Date.now },
  },
}, {
  timestamps: true,
  versionKey: false,
  collection: 'profiles',
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

profileSchema.index({ userId: 1 });
profileSchema.index({ role: 1 });
profileSchema.index({ verificationStatus: 1 });
profileSchema.index({ 'tradieInfo.serviceCategories': 1 });
profileSchema.index({ 'tradieInfo.availability.status': 1 });
profileSchema.index({ 'address.state': 1, 'address.postcode': 1 });
profileSchema.index({ 'ratings.overall': -1 });
profileSchema.index({ 'statistics.jobsCompleted': -1 });
profileSchema.index({ 'qualityScore.score': -1 });
profileSchema.index({ 'address.coordinates': '2dsphere' });

profileSchema.methods.calculateProfileCompletion = function(): number {
  const requiredFields = ['firstName', 'lastName', 'phone', 'address'];
  const roleSpecificFields = {
    tradie: ['tradieInfo.serviceCategories', 'tradieInfo.hourlyRate', 'tradieInfo.availability'],
    client: ['clientInfo.propertyType', 'clientInfo.communicationPreferences'],
    enterprise: ['enterpriseInfo.companySize', 'enterpriseInfo.teamStructure']
  };
  
  let completedFields = 0;
  let totalFields = requiredFields.length;
  
  requiredFields.forEach(field => {
    if (this.get(field)) completedFields++;
  });
  
  if (roleSpecificFields[this.role]) {
    totalFields += roleSpecificFields[this.role].length;
    roleSpecificFields[this.role].forEach(field => {
      if (this.get(field)) completedFields++;
    });
  }
  
  const percentage = Math.round((completedFields / totalFields) * 100);
  this.profileCompletion.percentage = percentage;
  this.profileCompletion.lastCalculated = new Date();
  
  return percentage;
};

profileSchema.methods.calculateQualityScore = function(): number {
  const factors = {
    profileCompleteness: this.profileCompletion.percentage * 0.3,
    verificationStatus: this.verificationStatus === 'verified' ? 25 : 0,
    reviewRating: this.ratings.overall * 5,
    responseTime: Math.max(0, 20 - (this.statistics.responseTime / 60)),
    jobCompletionRate: this.statistics.onTimeCompletionRate * 0.2
  };
  
  const score = Math.min(100, Object.values(factors).reduce((sum, val) => sum + val, 0));
  
  this.qualityScore.score = Math.round(score);
  this.qualityScore.factors = factors;
  this.qualityScore.lastCalculated = new Date();
  
  return this.qualityScore.score;
};

profileSchema.methods.isProfileComplete = function(): boolean {
  return this.calculateProfileCompletion() >= 80;
};

profileSchema.methods.canReceiveJobs = function(): boolean {
  return this.verificationStatus === 'verified' && 
         this.isProfileComplete() && 
         (this.role === 'tradie' ? this.tradieInfo?.availability.status === 'available' : true);
};

profileSchema.methods.updateStatistics = async function(): Promise<void> {
  this.statistics.lastActiveDate = new Date();
  await this.save();
  
  buildHiveLogger.profile.update(this.userId, ['statistics'], {
    profileId: this._id,
    lastActive: this.statistics.lastActiveDate,
  });
};

profileSchema.methods.addPortfolioItem = async function(item: any): Promise<void> {
  if (this.role === 'tradie' && this.tradieInfo) {
    this.tradieInfo.portfolio.push(item);
    await this.save();
    
    buildHiveLogger.profile.update(this.userId, ['portfolio'], {
      profileId: this._id,
      portfolioCount: this.tradieInfo.portfolio.length,
    });
  }
};

profileSchema.methods.updateAvailability = async function(status: AvailabilityStatus): Promise<void> {
  if (this.role === 'tradie' && this.tradieInfo) {
    this.tradieInfo.availability.status = status;
    await this.save();
    
    buildHiveLogger.profile.update(this.userId, ['availability'], {
      profileId: this._id,
      newStatus: status,
    });
  }
};

profileSchema.methods.addQualification = async function(qualification: any): Promise<void> {
  if (this.role === 'tradie' && this.tradieInfo) {
    this.tradieInfo.qualifications.push(qualification);
    await this.save();
    
    buildHiveLogger.profile.update(this.userId, ['qualifications'], {
      profileId: this._id,
      qualificationName: qualification.name,
    });
  }
};

profileSchema.methods.getServiceRadius = function(): number {
  if (this.role === 'tradie' && this.tradieInfo) {
    return this.tradieInfo.availability.serviceRadius;
  }
  if (this.role === 'enterprise' && this.enterpriseInfo) {
    return this.enterpriseInfo.operationalPreferences.workingRadius;
  }
  return 0;
};

profileSchema.methods.calculateDistance = function(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

profileSchema.methods.isWithinServiceArea = function(location: { latitude: number; longitude: number }): boolean {
  if (!this.address?.coordinates) return false;
  
  const distance = this.calculateDistance(
    this.address.coordinates.latitude,
    this.address.coordinates.longitude,
    location.latitude,
    location.longitude
  );
  
  return distance <= this.getServiceRadius();
};

profileSchema.pre('save', function(next) {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.displayName = `${this.firstName} ${this.lastName}`;
  }
  
  if (this.isModified()) {
    this.calculateProfileCompletion();
    this.calculateQualityScore();
  }
  
  next();
});

export const Profile = model<IProfileDocument>('Profile', profileSchema);

export default Profile;
