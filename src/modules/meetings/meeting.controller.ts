import { Request, Response, NextFunction } from "express";
import { MeetingService } from "./meeting.service";
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  InviteParticipantsDto,
  RsvpMeetingDto,
  SubmitAbsenceDto,
  ReviewAbsenceDto,
  MeetingQueryDto,
} from "./meeting.dto";

export class MeetingController {
  private readonly service = new MeetingService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as MeetingQueryDto,
        req.user!,
      );
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateMeetingDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        req.params.id,
        req.body as UpdateMeetingDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user!, {
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  inviteParticipants = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { participants } = req.body as InviteParticipantsDto;
      const data = await this.service.inviteParticipants(
        req.params.id,
        participants,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  rsvp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body as RsvpMeetingDto;
      const data = await this.service.rsvp(
        req.params.id,
        status,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  join = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.join(req.params.id, req.user!, {
        ipAddress: req.ip,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getBusyUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startTime, endTime, excludeMeetingId } = req.query as {
        startTime: string;
        endTime: string;
        excludeMeetingId?: string;
      };
      const data = await this.service.getBusyUsers(
        new Date(startTime),
        new Date(endTime),
        excludeMeetingId,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  submitAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.submitAbsence(
        req.params.id,
        req.user!,
        req.body as SubmitAbsenceDto,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  findAbsencesByMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.findAbsencesByMeeting(
        req.params.id,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getMyAbsences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getMyAbsences(req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPendingAbsences = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getPendingAbsences(req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  reviewAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.reviewAbsence(
        req.params.absenceId,
        req.user!,
        req.body as ReviewAbsenceDto,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateAttendance(
        req.params.id,
        req.body,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
