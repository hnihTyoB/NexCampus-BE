import { prisma } from "../../database/prisma.client";
import { NotificationDispatcher } from "./notification.dispatcher";
import { envConfig } from "../../config/env.config";
import { NOTIFICATION_TYPE } from "../../common/constants/status.constant";

export class ReminderService {
  /**
   * Scans for task assignments that are TODO or IN_PROGRESS,
   * where the task deadline is approaching (within the threshold hours).
   * Dispatches a TASK_REMINDER notification to the intern.
   */
  static async remindTasks(): Promise<{ sentCount: number }> {
    const thresholdHours = envConfig.reminders.thresholdHours;
    const now = new Date();
    const futureLimit = new Date(now.getTime() + thresholdHours * 60 * 60 * 1000);

    // Find assignments that are TODO or IN_PROGRESS, with deadline approaching
    const assignments = await prisma.taskAssignment.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        task: {
          deadline: {
            gte: now,
            lte: futureLimit,
          },
          deletedAt: null,
        },
        intern: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      select: {
        id: true,
        taskId: true,
        internId: true,
        status: true,
        assignedAt: true,
        updatedAt: true,
        task: {
          select: {
            id: true,
            title: true,
            deadline: true,
          },
        },
        intern: {
          select: {
            id: true,
            fullName: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    let sentCount = 0;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const assignment of assignments) {
      const internUser = assignment.intern.user;
      const task = assignment.task;

      // 1. Prevent duplicate notifications in the last 24h
      const duplicate = await prisma.notification.findFirst({
        where: {
          userId: internUser.id,
          type: NOTIFICATION_TYPE.TASK_REMINDER,
          content: { contains: task.title },
          createdAt: { gte: yesterday },
        },
      });

      if (duplicate) {
        console.log(
          `[ReminderService] Skip task reminder for user ${internUser.email} (already sent in last 24h)`
        );
        continue;
      }

      // 2. Dispatch reminder notification
      const formattedDeadline = task.deadline.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });

      await NotificationDispatcher.dispatch(internUser.id, NOTIFICATION_TYPE.TASK_REMINDER, {
        taskTitle: task.title,
        deadline: formattedDeadline,
      });

      console.log(
        `[ReminderService] Dispatched task reminder for "${task.title}" to ${internUser.email}`
      );
      sentCount++;
    }

    return { sentCount };
  }

  /**
   * Scans all active interns, calculates their current internship week,
   * checks if any weekly evaluation is missing, and dispatches an EVALUATION_REMINDER
   * notification to their leaders.
   */
  static async remindEvaluations(): Promise<{ sentCount: number }> {
    const activeInterns = await prisma.intern.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        leaderId: true,
        fullName: true,
        startDate: true,
        leader: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    let sentCount = 0;
    const now = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const intern of activeInterns) {
      if (!intern.leaderId) {
        continue; // No leader assigned yet
      }

      // Calculate current week of internship (1-based)
      const diffTime = now.getTime() - intern.startDate.getTime();
      if (diffTime < 0) {
        continue; // Internship hasn't started yet
      }

      const currentWeek = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;

      // Check each week from 1 to currentWeek
      for (let week = 1; week <= currentWeek; week++) {
        const evaluation = await prisma.weeklyEvaluation.findUnique({
          where: {
            internId_week: {
              internId: intern.id,
              week: week,
            },
          },
        });

        if (!evaluation) {
          // Check for duplicate reminder to the leader in the last 24h
          const duplicate = await prisma.notification.findFirst({
            where: {
              userId: intern.leaderId,
              type: NOTIFICATION_TYPE.EVALUATION_REMINDER,
              content: {
                contains: intern.fullName,
              },
              createdAt: { gte: yesterday },
            },
          });

          // Wait, to be super specific, let's also check if it contains the week number
          if (duplicate && duplicate.content.includes(`tuần ${week}`)) {
            console.log(
              `[ReminderService] Skip evaluation reminder for leader ${intern.leader?.email} for intern ${intern.fullName} week ${week} (already sent in last 24h)`
            );
            continue;
          }

          // Dispatch reminder to the leader
          await NotificationDispatcher.dispatch(
            intern.leaderId,
            NOTIFICATION_TYPE.EVALUATION_REMINDER,
            {
              internName: intern.fullName,
              week: week.toString(),
            }
          );

          console.log(
            `[ReminderService] Dispatched evaluation reminder to leader ${intern.leader?.email} for intern ${intern.fullName} (Week ${week})`
          );
          sentCount++;
        }
      }
    }

    return { sentCount };
  }

  /**
   * Helper method to run both tasks and evaluation reminders.
   */
  static async runAllReminders(): Promise<{ tasksSent: number; evaluationsSent: number }> {
    console.log("[ReminderService] Starting scheduled reminder execution...");
    const { sentCount: tasksSent } = await this.remindTasks();
    const { sentCount: evaluationsSent } = await this.remindEvaluations();

    // Auto-mark expired invites
    try {
      const now = new Date();
      const result = await prisma.applicationInvite.updateMany({
        where: {
          status: "ACTIVE",
          expiresAt: { lt: now },
        },
        data: {
          status: "EXPIRED",
        },
      });
      console.log(`[ReminderService] Auto-marked ${result.count} expired invites.`);
    } catch (inviteError) {
      console.error("[ReminderService] Error auto-marking expired invites:", inviteError);
    }

    console.log(
      `[ReminderService] Reminders completed: ${tasksSent} tasks, ${evaluationsSent} evaluations.`
    );
    return { tasksSent, evaluationsSent };
  }
}
