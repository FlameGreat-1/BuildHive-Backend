import { Router, Request, Response, NextFunction } from 'express';
import { ProfileController } from '../controllers';
import { 
  validateProfileCreation, 
  validateProfileUpdate,
  validateRegistrationPreferences,
  validatePreferencesUpdate
} from '../validators';
import { 
  requireEmailVerification,
  authenticate,
  handleValidationErrors,
  validateContentType,
  sanitizeProfileInput,
  profileLogger
} from '../middleware';
import { generalApiRateLimit, profileUpdateRateLimit } from '../../shared/middleware';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        emailVerified: boolean;
      };
    }
  }
}

const router = Router();
const profileController = new ProfileController();

router.use(authenticate);
router.use(profileLogger);

router.post(
  '/create',
  profileUpdateRateLimit,
  validateContentType,
  sanitizeProfileInput,
  validateProfileCreation(),
  validateRegistrationPreferences(),
  handleValidationErrors,
  profileController.createProfile
);

router.get(
  '/me',
  generalApiRateLimit,
  profileController.getProfile
);

router.put(
  '/me',
  profileUpdateRateLimit,
  validateContentType,
  sanitizeProfileInput,
  validateProfileUpdate(),
  handleValidationErrors,
  profileController.updateProfile
);

router.delete(
  '/me',
  profileController.deleteProfile
);

router.get(
  '/completeness',
  generalApiRateLimit,
  profileController.getProfileCompleteness
);

router.get(
  '/summary',
  generalApiRateLimit,
  profileController.getProfileSummary
);

router.get(
  '/preferences',
  generalApiRateLimit,
  profileController.getPreferences
);

router.put(
  '/preferences',
  profileUpdateRateLimit,
  validateContentType,
  validatePreferencesUpdate(),
  handleValidationErrors,
  profileController.updatePreferences
);

router.put(
  '/avatar',
  profileUpdateRateLimit,
  validateContentType,
  profileController.updateAvatar
);

router.delete(
  '/avatar',
  profileController.deleteAvatar
);

router.get(
  '/metadata',
  generalApiRateLimit,
  profileController.getMetadata
);

router.put(
  '/metadata',
  profileUpdateRateLimit,
  validateContentType,
  profileController.updateMetadata
);

router.patch(
  '/registration-source',
  generalApiRateLimit,
  validateContentType,
  profileController.updateRegistrationSource
);

export { router as profileRoutes };
