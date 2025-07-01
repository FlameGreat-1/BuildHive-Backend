import { UserRole } from '../../shared/types';

export interface Profile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  preferences: ProfilePreferences;
  metadata: ProfileMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfilePreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  language: string;
  currency: string;
}

export interface ProfileMetadata {
  registrationSource: string;
  lastLoginAt?: Date;
  loginCount: number;
  profileCompleteness: number;
}

export interface CreateProfileData {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  preferences?: Partial<ProfilePreferences>;
}

export interface ClientProfileExtension {
  companyName?: string;
  industry?: string;
  jobsPosted: number;
  totalSpent: number;
}

export interface TradieProfileExtension {
  abn?: string;
  qualifications: string[];
  hourlyRate?: number;
  serviceTypes: string[];
  availability: string;
  skills: string[];
  experienceYears?: number;
}

export interface EnterpriseProfileExtension {
  companyName: string;
  abn: string;
  industry: string;
  teamSize: number;
  departments: string[];
  adminUsers: string[];
}

export interface RoleSpecificProfile {
  [UserRole.CLIENT]: ClientProfileExtension;
  [UserRole.TRADIE]: TradieProfileExtension;
  [UserRole.ENTERPRISE]: EnterpriseProfileExtension;
}
