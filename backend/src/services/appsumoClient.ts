import { APPSUMO_CONFIG } from '../config/appsumoConfig';

export interface AppSumoLicenseDto {
  license_key: string;
  previous_license_key?: string | null;
  parent_license_key?: string | null;
  partner_plan_name?: string | null;
  tier: number;
  license_status: string;
  created_at: string;
  updated_at?: string;
  unit_quantity?: number;
  test?: boolean;
  extra?: Record<string, any>;
}

export interface AppSumoEventDto {
  id?: string;
  license_key: string;
  prev_license_key?: string | null;
  event: string;
  event_timestamp: string;
  created_at: string;
  tier?: number;
  license_status?: string;
  partner_plan_name?: string | null;
  parent_license_key?: string | null;
  unit_quantity?: number;
  test?: boolean;
  extra?: Record<string, any>;
}

export class AppSumoApiClient {
  private baseUrl: string;
  private apiKey: string;
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 20;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || APPSUMO_CONFIG.apiKey;
    this.baseUrl = (baseUrl || APPSUMO_CONFIG.apiBaseUrl).replace(/\/+$/, '');
  }

  /**
   * Internal rate-limiting tracker to enforce 20 requests per minute limit
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Purge timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = oldestInWindow + 60 * 1000 - now + 100; // buffer 100ms
      if (waitTime > 0) {
        console.warn(`[AppSumo Client] Approaching rate limit (20 req/min). Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('AppSumo API Key is not configured. Set APPSUMO_API_KEY environment variable.');
    }

    await this.enforceRateLimit();

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-AppSumo-Licensing-Key': this.apiKey,
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {}
      throw new Error(`AppSumo API request failed [${response.status} ${response.statusText}]: ${errorBody}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Fetch all licenses
   * GET /licenses
   */
  public async getLicenses(page: number = 1, perPage: number = 20): Promise<{ count: number; results: AppSumoLicenseDto[] }> {
    return this.request<{ count: number; results: AppSumoLicenseDto[] }>(`/licenses?page=${page}&per_page=${perPage}`);
  }

  /**
   * Fetch details for a specific license key
   * GET /licenses/:licenseKey
   */
  public async getLicense(licenseKey: string): Promise<AppSumoLicenseDto> {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request<AppSumoLicenseDto>(`/licenses/${encodeURIComponent(licenseKey)}`);
  }

  /**
   * Fetch license events across all licenses
   * GET /license-events
   */
  public async getLicenseEvents(page: number = 1, perPage: number = 20): Promise<{ count: number; results: AppSumoEventDto[] }> {
    return this.request<{ count: number; results: AppSumoEventDto[] }>(`/license-events?page=${page}&per_page=${perPage}`);
  }

  /**
   * Fetch events specifically for a given license key
   * GET /licenses/:licenseKey/events
   */
  public async getLicenseEventsByLicense(licenseKey: string): Promise<AppSumoEventDto[]> {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request<AppSumoEventDto[]>(`/licenses/${encodeURIComponent(licenseKey)}/events`);
  }

  /**
   * Fetch webhook delivery responses recorded by AppSumo for this license key
   * GET /licenses/:licenseKey/webhook-responses
   */
  public async getWebhookResponses(licenseKey: string): Promise<any[]> {
    if (!licenseKey) throw new Error('licenseKey is required');
    return this.request<any[]>(`/licenses/${encodeURIComponent(licenseKey)}/webhook-responses`);
  }

  /**
   * Fetch partner profile / credentials verification
   * GET /profile
   */
  public async getProfile(): Promise<any> {
    return this.request<any>('/profile');
  }
}

export const appSumoClient = new AppSumoApiClient();
