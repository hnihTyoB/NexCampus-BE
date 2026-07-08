import { ActivityLogRepository } from "./activity-log.repository";
import { ActivityLogQueryDto } from "./activity-log.dto";
import { ROLES } from "../../common/constants/role.constant";
import { ActivityAction } from "../../common/constants/activity-log.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class ActivityLogService {
  private readonly repository = new ActivityLogRepository();

  async findAll(query: ActivityLogQueryDto, user: UserPayload) {
    // If user is Intern, they can only see their own logs
    const userIdFilter = user.role === ROLES.INTERN ? user.id : undefined;
    return this.repository.findAll(query, userIdFilter);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async log(
    userId: string,
    action: ActivityAction,
    description: string,
    targetId?: string,
    targetType?: string,
  ) {
    try {
      return await this.repository.create({
        userId,
        action,
        description,
        targetId,
        targetType,
      });
    } catch (error) {
      // Do not block main flows if logging fails
      console.error("Failed to write activity log:", error);
    }
  }
}
