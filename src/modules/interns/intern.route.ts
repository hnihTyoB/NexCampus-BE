import { Router } from "express";
import { InternController } from "./intern.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  requirePermission,
  requireAnyPermission,
} from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  findAllInternSchema,
  lookupAssignmentInternSchema,
  createInternSchema,
  directCreateInternSchema,
  updateInternSchema,
  assignLeaderSchema,
  updateMeInternSchema,
  internIdParamSchema,
} from "./intern.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new InternController();

// ── Intern Self-Service Routes (Placed before /:id) ──
router.get("/me", authMiddleware, controller.getMe);
router.put(
  "/me",
  authMiddleware,
  validate(updateMeInternSchema),
  controller.updateMe,
);

// ── Specific Sub-Resource / Action Routes (Placed before /:id) ──
router.get(
  "/assignment-lookup",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_READ),
  validate(lookupAssignmentInternSchema, "query"),
  controller.lookupForAssignment,
);

router.post(
  "/direct",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_CREATE),
  validate(directCreateInternSchema),
  controller.directCreate,
);

// ── Intern Management Resource Routes ──
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_READ),
  validate(findAllInternSchema, "query"),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_READ),
  validate(internIdParamSchema, "params"),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_CREATE),
  validate(createInternSchema),
  controller.create,
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_UPDATE),
  validate(internIdParamSchema, "params"),
  validate(updateInternSchema),
  controller.update,
);

router.patch(
  "/:id/assign-leader",
  authMiddleware,
  requireAnyPermission(
    PERMISSIONS.INTERN_ASSIGN_LEADER,
    PERMISSIONS.INTERN_UPDATE,
  ),
  validate(internIdParamSchema, "params"),
  validate(assignLeaderSchema),
  controller.assignLeader,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.INTERN_DELETE),
  validate(internIdParamSchema, "params"),
  controller.delete,
);

export default router;
