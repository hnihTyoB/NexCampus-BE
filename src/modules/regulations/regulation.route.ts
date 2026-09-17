import { Router } from "express";
import {
  regulationController,
  RegulationController,
} from "./regulation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createRegulationSchema,
  updateRegulationSchema,
  regulationQuerySchema,
  regulationIdParamSchema,
} from "./regulation.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller: RegulationController = regulationController;

// ── Tra cứu nội quy dành cho người dùng có quyền REGULATION_READ ──
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_READ),
  validate(regulationQuerySchema, "query"),
  controller.findAll
);

router.get(
  "/active",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_READ),
  controller.findActive
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_READ),
  validate(regulationIdParamSchema, "params"),
  controller.findById
);

// ── Thực tập sinh xác nhận tuân thủ nội quy (Yêu cầu quyền REGULATION_ACKNOWLEDGE) ──
router.post(
  "/:id/acknowledge",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_ACKNOWLEDGE),
  validate(regulationIdParamSchema, "params"),
  controller.acknowledge
);

// ── Quản lý nội quy cơ quan (Yêu cầu permissions) ──
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_CREATE),
  validate(createRegulationSchema, "body"),
  controller.create
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_UPDATE),
  validate(regulationIdParamSchema, "params"),
  validate(updateRegulationSchema, "body"),
  controller.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_DELETE),
  validate(regulationIdParamSchema, "params"),
  controller.delete
);

router.patch(
  "/:id/activate",
  authMiddleware,
  requirePermission(PERMISSIONS.REGULATION_UPDATE),
  validate(regulationIdParamSchema, "params"),
  controller.activate
);

export default router;
