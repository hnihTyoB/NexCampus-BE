import { Router } from 'express';
import { TaskAttachmentController } from './task-attachment.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { uploadSingle } from '../../middlewares/upload.middleware';
import { ROLES } from '../../common/constants/role.constant';

// Router nay duoc mount tai /tasks/:taskId/attachments tu task.route.ts
// Su dung mergeParams: true de nhan taskId tu route cha
const router = Router({ mergeParams: true });
const controller = new TaskAttachmentController();

router.get(
  '/',
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER, ROLES.INTERN),
  controller.findByTask,
);

router.post(
  '/',
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  uploadSingle('file'),
  controller.upload,
);

router.delete(
  '/:attachmentId',
  authMiddleware,
  requireRole(ROLES.ADMIN, ROLES.LEADER),
  controller.delete,
);

export default router;
