import { Router } from 'express';
import { complaintsController } from './complaints.controller';
import { validate } from '../../middleware/validation.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { submitComplaintSchema, analyzeDraftSchema } from './complaints.validation';

const router = Router();

// Secure all routes with authentication
router.use(authenticate);

router.post('/', validate(submitComplaintSchema), complaintsController.create.bind(complaintsController));
router.get('/', complaintsController.list.bind(complaintsController));
router.post('/analyze', validate(analyzeDraftSchema), complaintsController.analyzeDraft.bind(complaintsController));
router.get('/:id', complaintsController.getById.bind(complaintsController));

export default router;
