import { Router, Request } from 'express';
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

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

const router = Router();
const profileController = new ProfileController();

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

router.get(
  '/me',
  generalApiRateLimit,
  requireEmailVerification,
  profileController.getProfile
);

router.get(
  '/completeness',
  generalApiRateLimit,
  requireEmailVerification,
  profileController.getProfileCompleteness
);

router.patch(
  '/registration-source',
  generalApiRateLimit,
  validateContentType,
  requireEmailVerification,
  profileController.updateRegistrationSource
);

export { router as profileRoutes };
