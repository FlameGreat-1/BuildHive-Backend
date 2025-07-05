import { Router } from 'express';
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

router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

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

router.get(
  '/jobs/:jobId/materials',
  validateJobId,
  auditLogger('get_materials_by_job'),
  asyncErrorHandler(jobController.getJobMaterials.bind(jobController))
);

router.get(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  auditLogger('get_material'),
  asyncErrorHandler(async (req, res, next) => {
    const materials = await jobController.getJobMaterials(req, res, next);
    if (materials && Array.isArray(materials)) {
      const material = materials.find(mat => mat.id === parseInt(req.params.id));
      if (material) {
        res.json({ success: true, data: material });
      } else {
        res.status(404).json({ success: false, message: 'Material not found' });
      }
    }
  })
);

router.put(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  handleValidationErrors,
  auditLogger('update_material'),
  asyncErrorHandler(jobController.updateJobMaterial.bind(jobController))
);

router.delete(
  '/jobs/:jobId/materials/:id',
  validateJobId,
  validateMaterialId,
  auditLogger('delete_material'),
  asyncErrorHandler(jobController.removeJobMaterial.bind(jobController))
);

router.get(
  '/summary/:jobId',
  validateJobId,
  auditLogger('get_material_summary'),
  asyncErrorHandler(async (req, res, next) => {
    const materials = await jobController.getJobMaterials(req, res, next);
    if (materials && Array.isArray(materials)) {
      const summary = {
        totalMaterials: materials.length,
        totalCost: materials.reduce((sum, mat) => sum + (mat.totalCost || 0), 0),
        averageCost: materials.length > 0 ? materials.reduce((sum, mat) => sum + (mat.totalCost || 0), 0) / materials.length : 0,
        suppliers: [...new Set(materials.map(mat => mat.supplier).filter(Boolean))]
      };
      res.json({ success: true, data: summary });
    }
  })
);

export default router;
