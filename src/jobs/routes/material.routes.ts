import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { authenticate } from '../../auth/middleware'; 
import { jobController } from '../controllers';
import {
  requireTradieRole,
  validateJobId,
  validateMaterialId,
  generalJobRateLimit,
  requestLogger,
  auditLogger,
  asyncErrorHandler,
  handleValidationErrors
} from '../middleware';
import { body } from 'express-validator';
import { MATERIAL_CONSTANTS, JOB_CONSTANTS } from '../../config/jobs';

const router = Router();

// Global middleware
router.use(authenticate);
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Material validation rules
const updateMaterialValidationRules = () => [
  body('name')
    .optional()
    .trim()
    .isLength({ 
      min: MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH,
      max: MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH 
    })
    .withMessage(`Material name must be between ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} and ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

  body('quantity')
    .optional()
    .isFloat({ 
      min: MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY,
      max: MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY 
    })
    .withMessage(`Quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`),

  body('unit')
    .optional()
    .isIn(Object.values(JOB_CONSTANTS.MATERIAL_UNITS))
    .withMessage('Invalid material unit'),

  body('unitCost')
    .optional()
    .isFloat({ 
      min: MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST,
      max: MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST 
    })
    .withMessage(`Unit cost must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST}`),

  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Supplier cannot exceed 200 characters')
];

// Get all materials for a job
router.get(
  '/jobs/:jobId/materials',
  validateJobId,
  auditLogger('get_materials_by_job'),
  asyncErrorHandler(jobController.getJobMaterials as any)
);

// Update material
router.put(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  handleValidationErrors,
  auditLogger('update_material'),
  asyncErrorHandler(async (req: any, res: Response, next: NextFunction) => {
    // Set the materialId parameter for the controller
    req.params.materialId = req.params.id;
    return await jobController.updateJobMaterial(req, res, next);
  })
);

// Delete material
router.delete(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  auditLogger('delete_material'),
  asyncErrorHandler(async (req: any, res: Response, next: NextFunction) => {
    // Set the materialId parameter for the controller
    req.params.materialId = req.params.id;
    return await jobController.removeJobMaterial(req, res, next);
  })
);

export default router;
