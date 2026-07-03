import { WeeklyEvaluationRepository } from './weekly-evaluation.repository';
import { InternRepository } from '../interns/intern.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { WeeklyEvaluationQueryDto, CreateWeeklyEvaluationDto, UpdateWeeklyEvaluationDto } from './weekly-evaluation.dto';
import { ROLES } from '../../common/constants/role.constant';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class WeeklyEvaluationService {
  private readonly repository = new WeeklyEvaluationRepository();
  private readonly internRepository = new InternRepository();

  async findAll(query: WeeklyEvaluationQueryDto, user: UserPayload) {
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern) {
        throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
      }
      query.internId = intern.id;
    }
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const evaluation = await this.repository.findById(id);

    if (!evaluation) {
      throw new AppError('Weekly evaluation not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return evaluation;
  }

  async create(data: CreateWeeklyEvaluationDto, leaderId: string) {
    // 1. Ensure intern exists and is not soft-deleted
    const intern = await this.internRepository.findById(data.internId);
    if (!intern) {
      throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Ensure unique evaluation per week for that intern
    const existing = await this.repository.findByInternAndWeek(data.internId, data.week);
    if (existing) {
      throw new AppError('An evaluation for this intern and week already exists', 409, ERROR_CODE.DUPLICATE_ENTRY);
    }

    // 3. Compute totalScore
    const totalScore = (data.communication + data.attitude + data.learning + data.coding) / 4;

    return this.repository.create(data, totalScore, leaderId);
  }

  async update(id: string, data: UpdateWeeklyEvaluationDto) {
    const evaluation = await this.findById(id);

    let totalScore: number | undefined;

    // Recalculate totalScore if any criteria changes
    if (
      data.communication !== undefined ||
      data.attitude !== undefined ||
      data.learning !== undefined ||
      data.coding !== undefined
    ) {
      const comm = data.communication !== undefined ? data.communication : evaluation.communication;
      const att = data.attitude !== undefined ? data.attitude : evaluation.attitude;
      const learn = data.learning !== undefined ? data.learning : evaluation.learning;
      const code = data.coding !== undefined ? data.coding : evaluation.coding;
      totalScore = (comm + att + learn + code) / 4;
    }

    return this.repository.update(id, data, totalScore);
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.delete(id);
  }
}
