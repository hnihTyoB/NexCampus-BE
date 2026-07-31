import { Request, Response, NextFunction } from "express";
import { MeetingService } from "./meeting.service";
import {
  MeetingQueryDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  InviteParticipantsDto,
  RsvpDto,
  SubmitAbsenceDto,
  ReviewAbsenceDto,
} from "./meeting.dto";

export class MeetingController {
  private readonly service = new MeetingService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as MeetingQueryDto;
      const result = await this.service.findAll(query, req.user);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = req.user.id;
      const body = req.body as CreateMeetingDto;
      const result = await this.service.create(body, createdBy);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateMeetingDto;
      const result = await this.service.update(req.params.id, body, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user);
      res.json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  inviteParticipants = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as InviteParticipantsDto;
      const result = await this.service.inviteParticipants(
        req.params.id,
        body,
        req.user,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  rsvp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as RsvpDto;
      const result = await this.service.rsvp(req.params.id, req.user, body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  join = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.joinMeeting(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  submitAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as SubmitAbsenceDto;
      const result = await this.service.submitAbsence(
        req.params.id,
        req.user,
        body,
      );
      res.status(201).json({ success: true, data: result });
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
      const result = await this.service.findAbsencesByMeeting(
        req.params.id,
        req.user,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  reviewAbsence = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ReviewAbsenceDto;
      const result = await this.service.reviewAbsence(
        req.params.absenceId,
        req.user,
        body,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMyAbsences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMyAbsences(req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getPendingAbsences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getAllAbsences();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
