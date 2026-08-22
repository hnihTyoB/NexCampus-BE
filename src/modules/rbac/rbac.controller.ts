import { Request, Response, NextFunction } from 'express';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignUserRoleDto, RoleQueryDto, AuditLogQueryDto } from './rbac.dto';

export class RbacController {
  private readonly service = new RbacService();

  findAllRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as RoleQueryDto;
      const result = await this.service.findAllRoles(query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findRoleById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.findRoleById(id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateRoleDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      const result = await this.service.createRole(body, context);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateRoleDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      const result = await this.service.updateRole(id, body, context);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      await this.service.deleteRole(id, context);
      res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  findAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findAllPermissions();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const role = await this.service.findRoleById(id);
      res.json({ success: true, data: role.permissions });
    } catch (error) {
      next(error);
    }
  };

  syncRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as AssignPermissionsDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      const result = await this.service.syncRolePermissions(id, body.permissionIds, context);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  removePermissionFromRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, permissionId } = req.params;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      const result = await this.service.removePermissionFromRole(id, permissionId, context);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  assignUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as AssignUserRoleDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };
      const result = await this.service.assignUserRole(id, body.roleId, context);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  findAllAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as AuditLogQueryDto;
      const result = await this.service.findAllAuditLogs(query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
