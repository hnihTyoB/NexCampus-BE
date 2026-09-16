import { Router } from "express";
import {
  regulationController,
  RegulationController,
} from "./regulation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createRegulationSchema,
  updateRegulationSchema,
  regulationQuerySchema,
  regulationIdParamSchema,
} from "./regulation.validation";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller: RegulationController = regulationController;

// ── Tra cứu nội quy dành cho người dùng đã xác thực ──
router.get(
  "/",
  authMiddleware,
  validate(regulationQuerySchema, "query"),
  controller.findAll
);

router.get("/active", authMiddleware, controller.findActive);

router.get(
  "/:id",
  authMiddleware,
  validate(regulationIdParamSchema, "params"),
  controller.findById
);

// ── Thực tập sinh xác nhận tuân thủ nội quy ──
router.post(
  "/:id/acknowledge",
  authMiddleware,
  validate(regulationIdParamSchema, "params"),
  controller.acknowledge
);

// ── Quản trị viên (Admin) quản lý nội quy cơ quan ──
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(createRegulationSchema, "body"),
  controller.create
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(regulationIdParamSchema, "params"),
  validate(updateRegulationSchema, "body"),
  controller.update
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(regulationIdParamSchema, "params"),
  controller.delete
);

router.patch(
  "/:id/activate",
  authMiddleware,
  requireRole(ROLES.ADMIN),
  validate(regulationIdParamSchema, "params"),
  controller.activate
);

export default router;
