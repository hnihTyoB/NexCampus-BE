# Frontend Maintenance Mode Integration Guide

Tài liệu hướng dẫn tích hợp **System Maintenance Mode** từ backend template vào các ứng dụng Frontend (Next.js, React, Vue, Svelte, Zalo Mini App, Flutter / React Native WebView).

---

## 1. Cơ chế hoạt động

Khi hệ thống bật chế độ bảo trì:
1. Toàn bộ API nghiệp vụ (Users, RBAC, Notifications, ...) trả về mã HTTP `503 Service Unavailable` với payload chuẩn:
   ```json
   {
     "success": false,
     "code": "SYSTEM_MAINTENANCE",
     "message": "Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.",
     "data": {
       "title": "Hệ thống đang bảo trì",
       "message": "Hệ thống đang được bảo trì để nâng cấp dịch vụ. Vui lòng quay lại sau.",
       "startAt": "2026-08-23T00:00:00.000Z",
       "estimatedEndAt": "2026-08-23T04:00:00.000Z"
     }
   }
   ```
2. Frontend nhận được lỗi `503` kèm `code: "SYSTEM_MAINTENANCE"` thông qua HTTP response interceptor và tự động điều hướng / render trang `/maintenance`.
3. Trang `/maintenance` có thể gọi API public `GET /api/v1/maintenance/public` (không yêu cầu đăng nhập) để kiểm tra thời gian dự kiến và đếm ngược (countdown).

---

## 2. Axios Response Interceptor

Thêm interceptor vào instance Axios toàn cục:

```typescript
import axios, { AxiosError } from 'axios';
import { isMaintenanceError } from './common/client/axios-interceptor.example';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888/api/v1',
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 503 && (error.response.data as any)?.code === 'SYSTEM_MAINTENANCE') {
      const maintenanceData = (error.response.data as any).data;
      
      // Lưu state hoặc chuyển hướng tới trang /maintenance
      if (typeof window !== 'undefined' && window.location.pathname !== '/maintenance') {
        // Tùy chọn: Lưu thông tin bảo trì vào sessionStorage để hiển thị tức thì
        sessionStorage.setItem('maintenance_info', JSON.stringify(maintenanceData));
        window.location.href = '/maintenance';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 3. React / Next.js Component `/maintenance`

```tsx
import React, { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [info, setInfo] = useState({
    title: 'Hệ thống đang bảo trì',
    message: 'Chúng tôi đang bảo trì để nâng cấp hệ thống.',
    estimatedEndAt: null as string | null,
  });

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/v1/maintenance/public');
      const data = await res.json();
      if (data.success && !data.data.enabled) {
        window.location.href = '/';
      } else if (data.data) {
        setInfo(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 30000); // Poll mỗi 30s
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <h1>{info.title}</h1>
      <p>{info.message}</p>
      {info.estimatedEndAt && (
        <p>Dự kiến hoàn tất: {new Date(info.estimatedEndAt).toLocaleString('vi-VN')}</p>
      )}
      <button onClick={checkStatus}>Kiểm tra lại</button>
    </div>
  );
}
```

---

## 4. Bỏ qua bảo trì cho Quản trị viên (Admin / Developers)

Tài khoản có quyền `MAINTENANCE_MANAGE` hoặc `MAINTENANCE_BYPASS` (hoặc vai trò `ADMIN`) khi gửi kèm Authorization token sẽ tự động được `maintenanceGuard` cho phép đi qua mọi API bình thường.
