// axios-logger.ts
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export function useAxiosLogger(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    // 记录开始时间
    (config as any).metadata = { startTime: new Date() };

    console.info(`[Request] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.headers) {
      console.debug(`[Request Headers]`, config.headers);
    }
    if (config.data) {
      const body = typeof config.data === 'object'
        ? JSON.stringify(config.data, null, 2)
        : config.data;
      console.debug(`[Request Body]\n${body}`);
    }

    return config;
  }, (error) => {
    console.error('[Request Error]', error);
    return Promise.reject(error);
  });

  instance.interceptors.response.use((response: AxiosResponse) => {
    const metadata = (response.config as any).metadata;
    const duration = metadata ? new Date().getTime() - metadata.startTime.getTime() : -1;

    console.info(`[Response] ${response.status} ${response.config.url} (${duration}ms)`);
    const data = typeof response.data === 'object'
      ? JSON.stringify(response.data, null, 2)
      : response.data;
    console.debug(`[Response Data]\n${data}`);

    return response;
  }, (error) => {
    if (error.response) {
      const metadata = (error.config as any)?.metadata;
      const duration = metadata ? new Date().getTime() - metadata.startTime.getTime() : -1;

      console.error(`[Response Error] ${error.response.status} ${error.response.config.url} (${duration}ms)`);
      const data = typeof error.response.data === 'object'
        ? JSON.stringify(error.response.data, null, 2)
        : error.response.data;
      console.error(`[Error Response Data]\n${data}`);
    } else {
      console.error('[Network Error]', error.message);
    }

    return Promise.reject(error);
  });
}

