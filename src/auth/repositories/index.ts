/**
 * Auth Repositories Index
 * Centralized exports for all authentication and profile repositories
 * 
 * BuildHive - Australian Tradie Marketplace
 * Clean Architecture - Repository Layer Exports
 */

// Repository Interfaces
export type { IUserRepository } from './user.repository';
export type { IProfileRepository } from './profile.repository';
export type { ISessionRepository } from './session.repository';

// Repository Implementations
export { UserRepository, userRepository } from './user.repository';
export { ProfileRepository, profileRepository } from './profile.repository';
export { SessionRepository, sessionRepository } from './session.repository';

// Default repository instances for dependency injection
export const repositories = {
  user: userRepository,
  profile: profileRepository,
  session: sessionRepository,
} as const;

// Repository factory for testing and dependency injection
export class RepositoryFactory {
  private static userRepo: IUserRepository = userRepository;
  private static profileRepo: IProfileRepository = profileRepository;
  private static sessionRepo: ISessionRepository = sessionRepository;

  /**
   * Get user repository instance
   */
  static getUserRepository(): IUserRepository {
    return this.userRepo;
  }

  /**
   * Get profile repository instance
   */
  static getProfileRepository(): IProfileRepository {
    return this.profileRepo;
  }

  /**
   * Get session repository instance
   */
  static getSessionRepository(): ISessionRepository {
    return this.sessionRepo;
  }

  /**
   * Set custom repository instances (for testing)
   */
  static setRepositories(repos: {
    user?: IUserRepository;
    profile?: IProfileRepository;
    session?: ISessionRepository;
  }): void {
    if (repos.user) this.userRepo = repos.user;
    if (repos.profile) this.profileRepo = repos.profile;
    if (repos.session) this.sessionRepo = repos.session;
  }

  /**
   * Reset to default repository instances
   */
  static resetToDefaults(): void {
    this.userRepo = userRepository;
    this.profileRepo = profileRepository;
    this.sessionRepo = sessionRepository;
  }

  /**
   * Get all repositories as object
   */
  static getAllRepositories() {
    return {
      user: this.userRepo,
      profile: this.profileRepo,
      session: this.sessionRepo,
    };
  }
}

// Export default repositories object
export default repositories;

/**
 * Repository Health Check
 * Utility function to verify all repositories are properly initialized
 */
export const checkRepositoryHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  repositories: {
    user: boolean;
    profile: boolean;
    session: boolean;
  };
  timestamp: Date;
}> => {
  try {
    const health = {
      status: 'healthy' as const,
      repositories: {
        user: !!userRepository,
        profile: !!profileRepository,
        session: !!sessionRepository,
      },
      timestamp: new Date(),
    };

    // Check if any repository is missing
    const allHealthy = Object.values(health.repositories).every(Boolean);
    if (!allHealthy) {
      health.status = 'unhealthy';
    }

    return health;
  } catch (error) {
    return {
      status: 'unhealthy',
      repositories: {
        user: false,
        profile: false,
        session: false,
      },
      timestamp: new Date(),
    };
  }
};

/**
 * Initialize all repositories with event publishers
 * For dependency injection of Redis pub/sub
 */
export const initializeRepositories = async (eventPublisher?: {
  publish(channel: string, data: any): Promise<void>;
}): Promise<void> => {
  if (eventPublisher) {
    userRepository.setEventPublisher(eventPublisher);
    profileRepository.setEventPublisher(eventPublisher);
    sessionRepository.setEventPublisher(eventPublisher);
  }
};
