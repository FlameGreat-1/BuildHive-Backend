import { Router } from 'express';
import { materialController } from '../controllers';
import {
  requireTradieRole,
  validateJobId,
  validateMaterialId,
  generalJobRateLimit,
  requestLogger,
  auditLogger,
  asyncErrorHandler
} from '../middleware';
import { body } from 'express-validator';
import { MATERIAL_CONSTANTS, JOB_CONSTANTS } from '../../config/jobs';
import { handleValidationErrors } from '../middleware';

const router = Router();

// Apply general middleware to all material routes
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
    .isLength({ max: MATERIAL_CONSTANTS.VALIDATION.SUPPLIER_MAX_LENGTH })
    .withMessage(`Supplier cannot exceed ${MATERIAL_CONSTANTS.VALIDATION.SUPPLIER_MAX_LENGTH} characters`)
];

// Material Operations (nested under jobs)
router.get(
  '/jobs/:jobId/materials',
  validateJobId,
  auditLogger('get_materials_by_job'),
  asyncErrorHandler(materialController.getMaterialsByJobId.bind(materialController))
);

router.put(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  handleValidationErrors,
  auditLogger('update_material'),
  asyncErrorHandler(materialController.updateMaterial.bind(materialController))
);

router.delete(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  auditLogger('delete_material'),
  asyncErrorHandler(materialController.deleteMaterial.bind(materialController))
);

export default router;
