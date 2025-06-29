import { Schema, model } from 'mongoose';
import { USER_ROLES, VERIFICATION_STATUS } from '../../config';
import { buildHiveLogger } from '../../shared';
import type { BaseDocument, UserRole, VerificationStatus, Address, BusinessInfo, ContactInfo } from '../../shared/types';

// Service categories for Tradies
export const SERVICE_CATEGORIES = {
  ELECTRICAL: 'electrical',
  PLUMBING: 'plumbing',
  CARPENTRY: 'carpentry',
  PAINTING: 'painting',
  ROOFING: 'roofing',
  LANDSCAPING: 'landscaping',
  CLEANING: 'cleaning',
  HANDYMAN: 'handyman',
  TILING: 'tiling',
  FLOORING: 'flooring',
  HVAC: 'hvac',
  SECURITY: 'security',
  OTHER: 'other',
} as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[keyof typeof SERVICE_CATEGORIES];

// Availability status for Tradies
export const AVAILABILITY_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  UNAVAILABLE: 'unavailable',
  VACATION: 'vacation',
} as const;

export type AvailabilityStatus = typeof AVAILABILITY_STATUS[keyof typeof AVAILABILITY_STATUS];

// Profile document interface extending BaseDocument
export interface IProfileDocument extends BaseDocument {
  // Core Profile Information
  userId: Schema.Types.ObjectId;
  role: UserRole;
  
  // Personal Information
  firstName: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Contact Information
  phone?: string;
  alternatePhone?: string;
  email?: string; // Can be different from user email
  preferredContact: 'email' | 'phone' | 'sms' | 'app';
  
  // Address Information (Australian Format)
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
  
  // Profile Media
  avatar?: string;
  coverImage?: string;
  gallery?: Array<{
    url: string;
    caption?: string;
    type: 'image' | 'video';
    uploadedAt: Date;
  }>;
  
  // Verification Status
  verificationStatus: VerificationStatus;
  verificationDocuments?: Array<{
    type: 'id' | 'license' | 'insurance' | 'qualification' | 'abn' | 'other';
    url: string;
    status: 'pending' | 'approved' | 'rejected';
    uploadedAt: Date;
    reviewedAt?: Date;
    reviewNotes?: string;
  }>;
  
  // Business Information (for Tradies and Enterprise)
  businessInfo?: {
    businessName?: string;
    abn?: string; // Australian Business Number
    acn?: string; // Australian Company Number
    tradingName?: string;
    businessType?: 'sole_trader' | 'partnership' | 'company' | 'trust';
    website?: string;
    description?: string;
    yearEstablished?: number;
    employeeCount?: number;
    servicesOffered?: string[];
  };
  
  // Tradie-Specific Information
  tradieInfo?: {
    // Service Details
    serviceCategories: ServiceCategory[];
    specializations: string[];
    hourlyRate?: {
      min: number;
      max: number;
      currency: string;
    };
    
    // Qualifications & Licenses
    qualifications: Array<{
      name: string;
      issuer: string;
      licenseNumber?: string;
      issueDate: Date;
      expiryDate?: Date;
      verified: boolean;
      documentUrl?: string;
    }>;
    
    // Insurance
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
    
    // Availability
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
      serviceRadius: number; // in kilometers
      travelFee?: number;
      emergencyAvailable: boolean;
      weekendAvailable: boolean;
    };
    
    // Portfolio & Experience
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
    
    // Tools & Equipment
    toolsAndEquipment?: string[];
    vehicleType?: string;
    
    // Pricing & Quotes
    quotingPreferences: {
      providesQuotes: boolean;
      quoteValidityDays: number;
      minimumJobValue?: number;
      calloutFee?: number;
      materialMarkup?: number; // percentage
    };
  };
  
  // Client-Specific Information
  clientInfo?: {
    propertyType?: 'residential' | 'commercial' | 'industrial';
    jobHistory: Array<{
      jobId: Schema.Types.ObjectId;
      title: string;
      category: ServiceCategory;
      completedDate: Date;
      rating?: number;
      review?: string;
    }>;
    preferredTradies: Schema.Types.ObjectId[];
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
  
  // Enterprise-Specific Information
  enterpriseInfo?: {
    // Company Details
    companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    industry: string[];
    headquarters: {
      street: string;
      suburb: string;
      state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
      postcode: string;
    };
    
    // Team Management
    teamStructure: {
      totalEmployees: number;
      activeFieldWorkers: number;
      adminStaff: number;
      supervisors: number;
    };
    
    // Service Areas
    serviceAreas: Array<{
      suburb: string;
      postcode: string;
      state: string;
      priority: 'primary' | 'secondary';
    }>;
    
    // Certifications & Compliance
    certifications: Array<{
      name: string;
      issuer: string;
      certificateNumber: string;
      issueDate: Date;
      expiryDate?: Date;
      documentUrl?: string;
      verified: boolean;
    }>;
    
    // Financial Information
    financialInfo?: {
      annualRevenue?: string; // range like "100k-500k"
      creditRating?: string;
      paymentTerms: string;
      preferredPaymentMethods: string[];
    };
    
    // Operational Preferences
    operationalPreferences: {
      minimumJobValue: number;
      maximumConcurrentJobs: number;
      workingRadius: number; // in kilometers
      emergencyServices: boolean;
      weekendOperations: boolean;
      after_hours_available: boolean;
    };
    
    // Client Portfolio
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
  
  // Ratings & Reviews System
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
      reviewId: Schema.Types.ObjectId;
      rating: number;
      comment: string;
      reviewerName: string;
      reviewDate: Date;
      jobCategory: ServiceCategory;
      verified: boolean;
    }>;
  };
  
  // Profile Statistics
  statistics: {
    profileViews: number;
    jobsCompleted: number;
    jobsInProgress: number;
    responseTime: number; // in hours
    responseRate: number; // percentage
    repeatClientRate: number; // percentage
    onTimeCompletionRate: number; // percentage
    lastActiveDate: Date;
    joinDate: Date;
  };
  
  // Preferences & Settings
  preferences: {
    // Notification Preferences
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
    
    // Privacy Settings
    privacy: {
      showPhone: boolean;
      showEmail: boolean;
      showAddress: boolean;
      showRates: boolean;
      allowDirectContact: boolean;
      profileVisibility: 'public' | 'registered_users' | 'private';
    };
    
    // Job Preferences
    jobPreferences: {
      autoAcceptJobs: boolean;
      jobValueRange: {
        min: number;
        max: number;
      };
      preferredJobTypes: ServiceCategory[];
      blacklistedClients: Schema.Types.ObjectId[];
      workingDistance: number;
      requiresDeposit: boolean;
      depositPercentage?: number;
    };
  };
  
  // Social & Professional Links
  socialLinks?: {
    website?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  
  // Emergency Contact
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  
  // Audit & Compliance
  compliance: {
    termsAccepted: boolean;
    termsAcceptedDate: Date;
    privacyPolicyAccepted: boolean;
    privacyPolicyAcceptedDate: Date;
    marketingConsent: boolean;
    dataRetentionConsent: boolean;
    lastPolicyUpdate?: Date;
  };
  
  // Profile Completion & Quality Score
  profileCompletion: {
    percentage: number;
    missingFields: string[];
    lastCalculated: Date;
  };
  
  qualityScore: {
    score: number; // 0-100
    factors: {
      profileCompleteness: number;
      verificationStatus: number;
      reviewRating: number;
      responseTime: number;
      jobCompletionRate: number;
    };
    lastCalculated: Date;
  };
  
  // Instance Methods
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
}

// Profile Schema Definition
const profileSchema = new Schema<IProfileDocument>({
  // Core Profile Information
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
  
  // Personal Information
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
        if (!value) return true; // Optional field
        const age = (new Date().getTime() - value.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 16 && age <= 100; // Must be between 16 and 100 years old
      },
      message: 'Age must be between 16 and 100 years'
    }
  },
  
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
  },
  
  // Contact Information
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
  
  // Address Information (Australian Format)
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

  // Profile Media
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
  
  // Verification Status
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
  
  // Business Information
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
  
  // Complex nested schemas for role-specific information
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
  
  // Ratings & Statistics
  ratings: {
    overall: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative'],
    },
    breakdown: {
      quality: { type: Number, default: 0, min: 0, max: 5 },
      communication: { type: Number, default: 0, min: 0, max: 5 },
      timeliness: { type: Number, default: 0, min: 0, max: 5 },
      professionalism: { type: Number, default: 0, min: 0, max: 5 },
      value: { type: Number, default: 0, min: 0, max: 5 },
    },
  },
  
  statistics: {
    profileViews: { type: Number, default: 0 },
    jobsCompleted: { type: Number, default: 0 },
    jobsInProgress: { type: Number, default: 0 },
    responseTime: { type: Number, default: 24 }, // hours
    responseRate: { type: Number, default: 100 }, // percentage
    repeatClientRate: { type: Number, default: 0 },
    onTimeCompletionRate: { type: Number, default: 100 },
    lastActiveDate: { type: Date, default: Date.now },
    joinDate: { type: Date, default: Date.now },
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
});

// Indexes for performance
profileSchema.index({ userId: 1 });
profileSchema.index({ role: 1, verificationStatus: 1 });
profileSchema.index({ 'address.state': 1, 'address.postcode': 1 });
profileSchema.index({ 'tradieInfo.serviceCategories': 1 });
profileSchema.index({ 'ratings.overall': -1 });
profileSchema.index({ 'businessInfo.abn': 1 }, { sparse: true });

// Instance Methods
profileSchema.methods.calculateProfileCompletion = function(): number {
  const requiredFields = ['firstName', 'lastName', 'phone'];
  const roleSpecificFields = {
    [USER_ROLES.TRADIE]: ['tradieInfo.serviceCategories', 'tradieInfo.hourlyRate', 'businessInfo.abn'],
    [USER_ROLES.CLIENT]: ['address'],
    [USER_ROLES.ENTERPRISE]: ['businessInfo.businessName', 'businessInfo.abn'],
  };
  
  let completedFields = 0;
  let totalFields = requiredFields.length;
  
  // Check required fields
  requiredFields.forEach(field => {
    if (this[field]) completedFields++;
  });
  
  // Check role-specific fields
  const roleFields = roleSpecificFields[this.role] || [];
  totalFields += roleFields.length;
  
  roleFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (value) completedFields++;
  });
  
  const percentage = Math.round((completedFields / totalFields) * 100);
  this.profileCompletion.percentage = percentage;
  this.profileCompletion.lastCalculated = new Date();
  
  return percentage;
};

profileSchema.methods.isProfileComplete = function(): boolean {
  return this.calculateProfileCompletion() >= 80;
};

profileSchema.methods.canReceiveJobs = function(): boolean {
  return this.verificationStatus === VERIFICATION_STATUS.VERIFIED &&
         this.isProfileComplete() &&
         (this.role === USER_ROLES.TRADIE ? this.tradieInfo?.availability?.status === AVAILABILITY_STATUS.AVAILABLE : true);
};

// Create and export the Profile model
export const Profile = model<IProfileDocument>('Profile', profileSchema);

export default Profile;
