import { Router } from 'express';
import { ProfileController } from '../controllers';
import { 
  validateProfileCreation, 
  validateRegistrationPreferences 
} from '../validators';
import { 
  requireEmailVerification,
  handleValidationErrors,
  validateContentType
} from '../middleware';
import { generalApiRateLimit } from '../../shared/middleware';

const router = Router();
const profileController = new ProfileController();

// Create Profile Route (for registration completion)
router.post(
  '/create',
  generalApiRateLimit,
  validateContentType,
  requireEmailVerification,
  validateProfileCreation(),
  validateRegistrationPreferences(),
  handleValidationErrors,
  profileController.createProfile
);

// Get Profile Route (for registration flow)
router.get(
  '/me',
  generalApiRateLimit,
  requireEmailVerification,
  profileController.getProfile
);

// Get Profile Completeness Route
router.get(
  '/completeness',
  generalApiRateLimit,
  requireEmailVerification,
  profileController.getProfileCompleteness
);

// Update Registration Source Route
router.patch(
  '/registration-source',
  generalApiRateLimit,
  validateContentType,
  requireEmailVerification,
  profileController.updateRegistrationSource
);

export { router as profileRoutes };
