/**
 * Helper thay thế an toàn các biến placeholder dạng {{variableName}} trong chuỗi template.
 * @param template Chuỗi mẫu (ví dụ: "Chào {{fullName}}, mã xác thực là {{token}}")
 * @param variables Object chứa các giá trị biến (ví dụ: { fullName: "Nguyễn Văn A", token: "123456" })
 * @returns Chuỗi sau khi đã thay thế các biến
 */
export function renderTemplateString(
  template: string,
  variables: Record<string, unknown> = {},
): string {
  if (!template) return '';

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}
