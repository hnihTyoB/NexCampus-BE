import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.validation";

const router = Router();
const controller = new AuthController();

router.post("/login", validate(loginSchema), controller.login);
router.get("/me", authMiddleware, controller.me);
router.put(
  "/me",
  authMiddleware,
  validate(updateMeSchema),
  controller.updateMe,
);
router.post("/refresh", validate(refreshSchema), controller.refresh);
router.post(
  "/logout",
  authMiddleware,
  validate(logoutSchema),
  controller.logout,
);

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  controller.forgotPassword,
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  controller.resetPassword,
);

router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  controller.changePassword,
);

router.post("/revoke-session", controller.revokeSession);

export default router;
