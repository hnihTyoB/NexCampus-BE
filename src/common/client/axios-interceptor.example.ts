/**
 * Frontend Client Maintenance Interceptor Pattern
 *
 * Reusable helper for client-side applications (Next.js, React, Vue, Zalo Mini App, Mobile WebView)
 * to handle HTTP 503 SYSTEM_MAINTENANCE responses globally.
 */

export interface MaintenanceResponsePayload {
  success: false;
  code: 'SYSTEM_MAINTENANCE';
  message: string;
  data: {
    title: string;
    message: string;
    estimatedEndAt?: string | null;
    startAt?: string | null;
  };
}

export interface ClientMaintenanceOptions {
  maintenanceRedirectPath?: string;
  onMaintenanceDetected?: (data: MaintenanceResponsePayload['data']) => void;
}

/**
 * Checks whether an HTTP error response is a System Maintenance error (503 SYSTEM_MAINTENANCE)
 * and invokes callback hooks or redirects.
 */
export function isMaintenanceError(
  error: any,
): error is { response: { status: number; data: MaintenanceResponsePayload } } {
  return (
    error?.response?.status === 503 &&
    error?.response?.data?.code === 'SYSTEM_MAINTENANCE'
  );
}

/**
 * Handles maintenance error in frontend Axios response interceptor
 *
 * Usage example in Axios:
 * ```ts
 * axiosInstance.interceptors.response.use(
 *   (res) => res,
 *   (error) => {
 *     if (isMaintenanceError(error)) {
 *       window.location.href = '/maintenance';
 *     }
 *     return Promise.reject(error);
 *   }
 * );
 * ```
 */
export function handleMaintenanceError(
  error: any,
  options?: ClientMaintenanceOptions,
): boolean {
  if (isMaintenanceError(error)) {
    if (options?.onMaintenanceDetected && error.response.data.data) {
      options.onMaintenanceDetected(error.response.data.data);
    }
    return true;
  }
  return false;
}
