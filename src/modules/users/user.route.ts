import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createUserSchema,
  findAllUserSchema,
  updateUserSchema,
} from "./user.validation";
import { ROLES } from "../../common/constants/role.constant";
import { uploadSingle } from "../../middlewares/upload.middleware";

const router = Router();
const controller = new UserController();

router.get(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(findAllUserSchema, "query"),
  controller.findAll,
);
router.get(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.findById,
);
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createUserSchema),
  controller.create,
);
router.post(
  "/avatar",
  authMiddleware,
  uploadSingle("avatar", "avatar"),
  controller.uploadAvatar,
);
router.get(
  "/avatar/upload-url",
  authMiddleware,
  controller.getAvatarPutUrl,
);
router.post(
  "/avatar/confirm",
  authMiddleware,
  controller.confirmAvatarUpload,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(updateUserSchema),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  controller.delete,
);

export default router;
