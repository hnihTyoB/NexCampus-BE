import { DailyReportRepository } from './daily-report.repository';
import { InternRepository } from '../interns/intern.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { DailyReportQueryDto, CreateDailyReportDto, UpdateDailyReportDto } from './daily-report.dto';
import { ROLES } from '../../common/constants/role.constant';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class DailyReportService {
  private readonly repository = new DailyReportRepository();
  private readonly internRepository = new InternRepository();

  async findAll(query: DailyReportQueryDto, user: UserPayload) {
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
    const report = await this.repository.findById(id);

    if (!report) {
      throw new AppError('Daily report not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return report;
  }

  async create(data: CreateDailyReportDto, user: UserPayload) {
    const intern = await this.internRepository.findByUserId(user.id);
    if (!intern) {
      throw new AppError('Intern profile not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return this.repository.create(data, intern.id);
  }

  async update(id: string, data: UpdateDailyReportDto, user: UserPayload) {
    const report = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern || report.internId !== intern.id) {
        throw new AppError('You are not authorized to update this report', 403, ERROR_CODE.FORBIDDEN);
      }
    }

    return this.repository.update(id, data);
  }

  async delete(id: string, user: UserPayload) {
    const report = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern || report.internId !== intern.id) {
        throw new AppError('You are not authorized to delete this report', 403, ERROR_CODE.FORBIDDEN);
      }
    }

    return this.repository.delete(id);
  }
}
