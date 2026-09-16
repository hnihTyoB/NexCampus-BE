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

export interface RegulationQueryDto {
  page?: number;
  limit?: number;
  title?: string;
  isActive?: boolean;
}

export interface RegulationResponseDto {
  id: string;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
  totalAcknowledged?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegulationListResponseDto {
  total: number;
  page: number;
  limit: number;
  items: RegulationResponseDto[];
}
