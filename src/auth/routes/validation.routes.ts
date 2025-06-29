import { Router } from 'express';
import { 
  asyncHandler, 
  validateRequest, 
  rateLimiters,
  requireAuth,
  type IValidationController 
} from '../controllers';
import { validationSchemas } from '../validators';
import { authMiddleware } from '../middleware';

export function createValidationRoutes(validationController: IValidationController): Router {
  const router = Router();

  router.post('/email/send',
    rateLimiters.verification,
    validateRequest(validationSchemas.sendEmailVerification),
    asyncHandler(validationController.sendEmailVerification.bind(validationController))
  );

  router.post('/email/verify',
    rateLimiters.verification,
    validateRequest(validationSchemas.verifyEmail),
    asyncHandler(validationController.verifyEmail.bind(validationController))
  );

  router.post('/email/resend',
    rateLimiters.verification,
    validateRequest(validationSchemas.resendEmailVerification),
    asyncHandler(validationController.resendEmailVerification.bind(validationController))
  );

  router.post('/phone/send',
    rateLimiters.verification,
    validateRequest(validationSchemas.sendPhoneVerification),
    asyncHandler(validationController.sendPhoneVerification.bind(validationController))
  );

  router.post('/phone/verify',
    rateLimiters.verification,
    validateRequest(validationSchemas.verifyPhone),
    asyncHandler(validationController.verifyPhone.bind(validationController))
  );

  router.post('/phone/resend',
    rateLimiters.verification,
    validateRequest(validationSchemas.resendPhoneVerification),
    asyncHandler(validationController.resendPhoneVerification.bind(validationController))
  );

  router.post('/business/validate',
    rateLimiters.general,
    validateRequest(validationSchemas.validateBusinessNumber),
    asyncHandler(validationController.validateBusinessNumber.bind(validationController))
  );

  router.post('/trade-license/validate',
    rateLimiters.general,
    validateRequest(validationSchemas.validateTradeLicense),
    asyncHandler(validationController.validateTradeLicense.bind(validationController))
  );

  router.get('/email/availability',
    rateLimiters.general,
    validateRequest(validationSchemas.checkEmailAvailability),
    asyncHandler(validationController.checkEmailAvailability.bind(validationController))
  );

  router.get('/phone/availability',
    rateLimiters.general,
    validateRequest(validationSchemas.checkPhoneAvailability),
    asyncHandler(validationController.checkPhoneAvailability.bind(validationController))
  );

  router.get('/postcode/validate',
    rateLimiters.general,
    validateRequest(validationSchemas.validatePostcode),
    asyncHandler(validationController.validatePostcode.bind(validationController))
  );

  router.get('/status',
    authMiddleware,
    asyncHandler(validationController.getVerificationStatus.bind(validationController))
  );

  router.get('/health',
    asyncHandler(validationController.healthCheck.bind(validationController))
  );

  return router;
}

export default createValidationRoutes;
