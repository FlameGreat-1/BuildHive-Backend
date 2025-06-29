import { Router } from 'express';
import multer from 'multer';
import { 
  asyncHandler, 
  validateRequest, 
  rateLimiters,
  requireAuth,
  requireRole,
  requireEmailVerification,
  type IProfileController 
} from '../controllers';
import { 
  createProfileSchema, 
  updateProfileSchema, 
  tradieProfileSchema, 
  searchProfilesSchema, 
  uploadImageSchema 
} from '../validators';
import { authMiddleware, profileOwnershipMiddleware, imageUploadMiddleware } from '../middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

export function createProfileRoutes(profileController: IProfileController): Router {
  const router = Router();

  router.get('/search',
    rateLimiters.general,
    validateRequest(searchProfilesSchema),
    asyncHandler(profileController.searchProfiles.bind(profileController))
  );

  router.get('/role/:role',
    rateLimiters.general,
    asyncHandler(profileController.getProfilesByRole.bind(profileController))
  );

  router.get('/:id',
    rateLimiters.general,
    asyncHandler(profileController.getProfile.bind(profileController))
  );

  router.post('/',
    authMiddleware,
    requireEmailVerification,
    rateLimiters.general,
    validateRequest(createProfileSchema),
    asyncHandler(profileController.createProfile.bind(profileController))
  );

  router.put('/:id',
    authMiddleware,
    profileOwnershipMiddleware,
    rateLimiters.general,
    validateRequest(updateProfileSchema),
    asyncHandler(profileController.updateProfile.bind(profileController))
  );

  router.delete('/:id',
    authMiddleware,
    profileOwnershipMiddleware,
    asyncHandler(profileController.deleteProfile.bind(profileController))
  );

  router.post('/:id/images',
    authMiddleware,
    profileOwnershipMiddleware,
    upload.single('image'),
    imageUploadMiddleware,
    validateRequest(uploadImageSchema),
    asyncHandler(profileController.uploadProfileImage.bind(profileController))
  );

  router.put('/:id/services',
    authMiddleware,
    profileOwnershipMiddleware,
    requireRole('tradie'),
    rateLimiters.general,
    validateRequest(tradieProfileSchema),
    asyncHandler(profileController.updateTradieServices.bind(profileController))
  );

  router.put('/:id/availability',
    authMiddleware,
    profileOwnershipMiddleware,
    requireRole('tradie'),
    rateLimiters.general,
    asyncHandler(profileController.updateTradieAvailability.bind(profileController))
  );

  router.post('/:id/qualifications',
    authMiddleware,
    profileOwnershipMiddleware,
    requireRole('tradie'),
    rateLimiters.general,
    asyncHandler(profileController.addTradieQualification.bind(profileController))
  );

  router.put('/:id/insurance',
    authMiddleware,
    profileOwnershipMiddleware,
    requireRole('tradie'),
    rateLimiters.general,
    asyncHandler(profileController.updateTradieInsurance.bind(profileController))
  );

  router.post('/:id/portfolio',
    authMiddleware,
    profileOwnershipMiddleware,
    requireRole('tradie'),
    rateLimiters.general,
    asyncHandler(profileController.addPortfolioItem.bind(profileController))
  );

  router.get('/:id/completion',
    authMiddleware,
    profileOwnershipMiddleware,
    asyncHandler(profileController.getProfileCompletion.bind(profileController))
  );

  router.get('/:id/quality-score',
    authMiddleware,
    profileOwnershipMiddleware,
    asyncHandler(profileController.getQualityScore.bind(profileController))
  );

  router.post('/:id/verify',
    authMiddleware,
    requireRole(['admin', 'moderator']),
    asyncHandler(profileController.verifyProfile.bind(profileController))
  );

  router.post('/:id/deactivate',
    authMiddleware,
    profileOwnershipMiddleware,
    asyncHandler(profileController.deactivateProfile.bind(profileController))
  );

  router.get('/health',
    asyncHandler(profileController.healthCheck.bind(profileController))
  );

  return router;
}

export default createProfileRoutes;
