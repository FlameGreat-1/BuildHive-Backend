// Service Interfaces
export type { IAuthService } from './auth.service';
export type { ITokenService, ITokenCache } from './token.service';
export type { IUserService } from './user.service';
export type { IProfileService } from './profile.service';
export type { IEmailService } from './email.service';
export type { ISMSService } from './sms.service';

// Service Implementations
export { AuthService } from './auth.service';
export { TokenService } from './token.service';
export { UserService } from './user.service';
export { ProfileService } from './profile.service';
export { EmailService } from './email.service';
export { SMSService } from './sms.service';

// Email Service Types
export type {
  EmailTemplate,
  EmailOptions,
  EmailVerificationData,
  PasswordResetData,
  WelcomeEmailData,
  AccountStatusData,
  SubscriptionUpdateData,
  CreditTransactionData
} from './email.service';

// SMS Service Types
export type {
  SMSTemplate,
  SMSOptions,
  VerificationCodeData,
  SecurityAlertData,
  SMSDeliveryResult
} from './sms.service';

// Shared Service Interfaces
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

// Service Factory Types
export interface ServiceDependencies {
  userRepository: import('../repositories').IUserRepository;
  profileRepository: import('../repositories').IProfileRepository;
  sessionRepository: import('../repositories').ISessionRepository;
  tokenCache: ITokenCache;
  eventPublisher: IEventPublisher;
  fileUploadService: IFileUploadService;
  geolocationService: IGeolocationService;
}

// Service Container with Dependency Injection
export class ServiceContainer {
  private readonly dependencies: ServiceDependencies;
  private authService?: IAuthService;
  private tokenService?: ITokenService;
  private userService?: IUserService;
  private profileService?: IProfileService;
  private emailService?: IEmailService;
  private smsService?: ISMSService;

  constructor(dependencies: ServiceDependencies) {
    this.dependencies = dependencies;
  }

  getAuthService(): IAuthService {
    if (!this.authService) {
      this.authService = new AuthService(
        this.dependencies.userRepository,
        this.dependencies.sessionRepository,
        this.dependencies.profileRepository,
        this.getTokenService(),
        this.getEmailService(),
        this.getSMSService(),
        this.dependencies.eventPublisher
      );
    }
    return this.authService;
  }

  getTokenService(): ITokenService {
    if (!this.tokenService) {
      this.tokenService = new TokenService(this.dependencies.tokenCache);
    }
    return this.tokenService;
  }

  getUserService(): IUserService {
    if (!this.userService) {
      this.userService = new UserService(
        this.dependencies.userRepository,
        this.dependencies.profileRepository,
        this.dependencies.sessionRepository,
        this.getEmailService(),
        this.dependencies.eventPublisher
      );
    }
    return this.userService;
  }

  getProfileService(): IProfileService {
    if (!this.profileService) {
      this.profileService = new ProfileService(
        this.dependencies.profileRepository,
        this.dependencies.userRepository,
        this.dependencies.fileUploadService,
        this.dependencies.geolocationService,
        this.dependencies.eventPublisher
      );
    }
    return this.profileService;
  }

  getEmailService(): IEmailService {
    if (!this.emailService) {
      this.emailService = new EmailService();
    }
    return this.emailService;
  }

  getSMSService(): ISMSService {
    if (!this.smsService) {
      this.smsService = new SMSService();
    }
    return this.smsService;
  }

  // Utility method to get all services
  getAllServices() {
    return {
      auth: this.getAuthService(),
      token: this.getTokenService(),
      user: this.getUserService(),
      profile: this.getProfileService(),
      email: this.getEmailService(),
      sms: this.getSMSService()
    };
  }

  // Health check for all services
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    try {
      // Check if services can be instantiated
      this.getTokenService();
      results.token = true;
    } catch {
      results.token = false;
    }

    try {
      this.getEmailService();
      results.email = true;
    } catch {
      results.email = false;
    }

    try {
      this.getSMSService();
      results.sms = true;
    } catch {
      results.sms = false;
    }

    try {
      this.getAuthService();
      results.auth = true;
    } catch {
      results.auth = false;
    }

    try {
      this.getUserService();
      results.user = true;
    } catch {
      results.user = false;
    }

    try {
      this.getProfileService();
      results.profile = true;
    } catch {
      results.profile = false;
    }

    return results;
  }
}

// Factory function for creating service container
export function createServiceContainer(dependencies: ServiceDependencies): ServiceContainer {
  return new ServiceContainer(dependencies);
}

// Default export
export default {
  AuthService,
  TokenService,
  UserService,
  ProfileService,
  EmailService,
  SMSService,
  ServiceContainer,
  createServiceContainer
};
