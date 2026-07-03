import { ApplicationRepository } from './application.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { ApplicationQueryDto, CreateApplicationDto, ReviewApplicationDto } from './application.dto';
import { APPLICATION_STATUS } from '../../common/constants/status.constant';

export class ApplicationService {
  private readonly repository = new ApplicationRepository();

  async findAll(query: ApplicationQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const application = await this.repository.findById(id);

    if (!application) {
      throw new AppError('Application not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return application;
  }

  async create(data: CreateApplicationDto) {
    return this.repository.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      department: data.department,
      position: data.position,
      startDate: new Date(data.startDate),
      duration: data.duration,
    });
  }

  async review(id: string, dto: ReviewApplicationDto, approverId: string) {
    const application = await this.findById(id);

    if (application.status !== APPLICATION_STATUS.PENDING) {
      throw new AppError(
        `Application is already ${application.status.toLowerCase()}`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.review(id, dto.status, approverId);
  }

  async delete(id: string) {
    const application = await this.findById(id);

    if (application.status === APPLICATION_STATUS.APPROVED) {
      throw new AppError(
        'Cannot delete an approved application',
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.softDelete(id);
  }
}
