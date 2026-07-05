import { Router } from 'express';
import { TaskSubmissionController } from './task-submission.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  findAllSubmissionSchema,
  createSubmissionSchema,
  updateSubmissionSchema,
} from './task-submission.validation';
import { ROLES } from '../../common/constants/role.constant';
import submissionAttachmentRoute from '../submission-attachments/submission-attachment.route';
import { uploadSingle } from '../../middlewares/upload.middleware';

const router = Router();
const controller = new TaskSubmissionController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), validate(findAllSubmissionSchema, 'query'), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.INTERN), validate(createSubmissionSchema), controller.create);
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), validate(updateSubmissionSchema), controller.update);
router.post('/:id/video', authMiddleware, requireRole(ROLES.INTERN), uploadSingle('video'), controller.uploadVideo);
router.delete('/:id', authMiddleware, requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN), controller.delete);

router.use('/:submissionId/attachments', submissionAttachmentRoute);

export default router;
