export interface CreateRegulationDto {
  title: string;
  content: string;
  isActive?: boolean;
}

export interface UpdateRegulationDto {
  title?: string;
  content?: string;
  isActive?: boolean;
}

export interface RegulationResponseDto {
  id: string;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
