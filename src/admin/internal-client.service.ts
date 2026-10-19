import { BadGatewayException, Injectable } from '@nestjs/common';
import { config } from '../config/config';

/** Calls the logger/notifier over the private Docker network with the shared key. */
@Injectable()
export class InternalClient {
  async get<T = any>(base: 'logger' | 'notifier', path: string, query: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(path, base === 'logger' ? config.loggerUrl : config.notifierUrl);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    return this.send<T>(url, { method: 'GET' });
  }

  async post<T = any>(base: 'logger' | 'notifier', path: string, body: unknown = {}): Promise<T> {
    const url = new URL(path, base === 'logger' ? config.loggerUrl : config.notifierUrl);
    return this.send<T>(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  }

  private async send<T>(url: URL, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), 'x-internal-key': config.internalApiKey },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new BadGatewayException(`${url.host} is unreachable.`);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadGatewayException(body?.message ?? `${url.host} returned ${res.status}.`);
    return body as T;
  }
}
