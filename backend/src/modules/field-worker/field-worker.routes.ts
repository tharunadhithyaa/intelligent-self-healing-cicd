import { Router, Response, NextFunction } from 'express';
import { fieldWorkerController } from './field-worker.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { ApiError } from '../../utils/api-error.util';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import { updateJobStatusSchema, uploadPhotosSchema } from './field-worker.validation';

const router = Router();

const checkFieldWorkerRole = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'field_worker' || req.user.role === 'admin')) {
    next();
  } else {
    next(ApiError.forbidden('Only municipal field workers are authorized to access this workspace'));
  }
};

// Protect all routes with authentication and field_worker role
router.use(authenticate);
router.use(checkFieldWorkerRole);

router.get('/jobs', fieldWorkerController.getAssignedJobs.bind(fieldWorkerController));
router.get('/jobs/:id', fieldWorkerController.getJobDetails.bind(fieldWorkerController));
router.put(
  '/jobs/:id/status',
  validate(updateJobStatusSchema),
  fieldWorkerController.updateJobStatus.bind(fieldWorkerController)
);
router.post(
  '/jobs/:id/photos',
  validate(uploadPhotosSchema),
  fieldWorkerController.uploadPhotos.bind(fieldWorkerController)
);

export default router;
