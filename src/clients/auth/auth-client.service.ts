import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Request } from 'express';
import { getClientIp } from 'src/common/tools/get-client-ip';
import { propagateAxiosError } from 'src/common/tools/propagate-axios-error';

@Injectable()
export class AuthClientService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async canDo(permission: string, token: string, request: Request): Promise<boolean> {
    const authApi = await this.axiosAuthApi(request);
    const response = await authApi.get<boolean>(`/users/can-do/${permission}`, {
      headers: { Authorization: `Bearer ${token}`}
    })

    return response.data;
  }

  async getEndpointPermissions(key: string, request: Request): Promise<string[]> {
    const authApi = await this.axiosAuthApi(request);
    const response = await authApi.get<string[]>(`/permissions/${key}`);

    return response.data;
  }

  private async axiosAuthApi(request: Request) {
    const baseUrl = this.configService.get<string>('AUTH_SERVICE_URL');
    const apiKey = this.configService.get<string>('AUTH_SERVICE_API_KEY');

    const authApi = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    })

    authApi.interceptors.request.use(async (config) => {
      config.headers['x-api-key'] = apiKey;
      config.headers['content-type'] = 'application/json';
      config.headers['x-forwarded-for'] = getClientIp(request);
      config.headers['x-real-ip'] = getClientIp(request);
      config.headers['user-agent'] = request.headers['user-agent'] || '';
      return config;
    },
      error => propagateAxiosError(error)
      );

    authApi.interceptors.response.use(response => response, error => propagateAxiosError(error));

    return authApi;
  }
}