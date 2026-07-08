import { InternRepository } from "./intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { InternQueryDto, CreateInternDto, UpdateInternDto } from "./intern.dto";

export class InternService {
  private readonly repository = new InternRepository();

  async findAll(query: InternQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const profile = await this.repository.findById(id);

    if (!profile) {
      throw new AppError("Intern not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return profile;
  }

  async create(data: CreateInternDto) {
    const existing = await this.repository.findByUserId(data.userId);

    if (existing) {
      throw new AppError(
        "This user already has an intern profile",
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.create(data);
  }

  async update(id: string, data: UpdateInternDto) {
    await this.findById(id);

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.softDelete(id);
  }
}
