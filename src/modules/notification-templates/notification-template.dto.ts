export interface CreateNotificationTemplateDto {
  type: string;
  titleTemplate: string;
  contentTemplate: string;
  emailSubjectTemplate?: string;
  emailContentTemplate?: string;
}

export interface UpdateNotificationTemplateDto {
  titleTemplate?: string;
  contentTemplate?: string;
  emailSubjectTemplate?: string | null;
  emailContentTemplate?: string | null;
}
