import { All, Body, Controller, Get, Header, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { config } from '../config/config';
import { Meta, type RequestMeta } from '../common/request-context';
import { SameOriginGuard, SessionGuard } from '../sessions/guards';
import { SessionsService } from '../sessions/sessions.service';
import { ClientsService } from './clients.service';
import { KeysService } from './keys.service';
import { OAuthError, UnsafeAuthorizeError } from './oauth.errors';
import { AuthorizeParams, OAuthService, ValidatedAuthorize } from './oauth.service';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Confirm who you are',
  profile: 'See your name',
  email: 'See your email address',
  offline_access: 'Stay signed in when you’re not using it',
};

@Controller()
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly keys: KeysService,
    private readonly sessions: SessionsService,
    private readonly clients: ClientsService,
  ) {}

  @Get('.well-known/openid-configuration')
  @SkipThrottle()
  @Header('Cache-Control', 'public, max-age=3600')
  discovery() {
    return this.oauth.discovery();
  }

  @Get('oauth/jwks')
  @SkipThrottle()
  @Header('Cache-Control', 'public, max-age=3600')
  jwks() {
    return this.keys.getJwks();
  }

  /**
   * The browser entry point. Decides between: back to the app with a code,
   * our sign-in page, the verify-email page, or the consent page.
   */
  @Get('oauth/authorize')
  async authorize(@Query() query: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const params = this.oauth.pickParams(query);
    let v: ValidatedAuthorize;
    try {
      v = await this.oauth.validateAuthorize(params);
    } catch (err) {
      return this.handleAuthorizeError(err, res);
    }

    const resolved = await this.sessions.resolve(this.sessions.readCookie(req));
    const tooOld =
      resolved && v.maxAge !== undefined && (Date.now() - new Date(resolved.session.created_at).getTime()) / 1000 > v.maxAge;

    if (!resolved || v.prompt.has('login') || tooOld) {
      if (v.prompt.has('none')) return res.redirect(this.oauth.redirectError(v, 'login_required', 'The user is not signed in.').toString());
      const next = { ...params };
      delete next.prompt;
      delete next.max_age;
      if (resolved && (v.prompt.has('login') || tooOld)) {
        await this.sessions.revoke(resolved.session.id);
        this.sessions.clearCookie(res);
      }
      return res.redirect(`${config.publicUrl}/login?return_to=${encodeURIComponent(authorizePath(next))}`);
    }

    const { user, session } = resolved;
    if (config.security.requireVerifiedEmail && !user.email_verified_at) {
      if (v.prompt.has('none')) return res.redirect(this.oauth.redirectError(v, 'login_required', 'Email not verified.').toString());
      return res.redirect(`${config.publicUrl}/verify-email?pending=1&return_to=${encodeURIComponent(authorizePath(params))}`);
    }

    if (v.prompt.has('consent') || !(await this.oauth.hasConsent(user.id, v.client, v.scopes))) {
      if (v.prompt.has('none')) return res.redirect(this.oauth.redirectError(v, 'consent_required', 'Consent is required.').toString());
      const q = new URLSearchParams(params as Record<string, string>);
      q.delete('prompt');
      return res.redirect(`${config.publicUrl}/consent?${q.toString()}`);
    }

    const url = await this.oauth.issueCode(v, user, session);
    return res.redirect(url.toString());
  }

  /** Data for the consent screen. */
  @Get('oauth/consent')
  @UseGuards(SessionGuard)
  async consentInfo(@Query() query: Record<string, unknown>) {
    const v = await this.validateForUi(this.oauth.pickParams(query));
    return {
      client: { name: v.client.name, description: v.client.description, homepageUrl: v.client.homepage_url, logoUrl: v.client.logo_url },
      scopes: v.scopes.map((s) => ({ scope: s, description: SCOPE_DESCRIPTIONS[s] ?? s })),
    };
  }

  /** The user approved or denied on the consent screen. */
  @Post('oauth/consent')
  @HttpCode(200)
  @UseGuards(SameOriginGuard, SessionGuard)
  async consentDecision(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const v = await this.validateForUi(this.oauth.pickParams(body));
    if (body.approve !== true) {
      return { redirectTo: this.oauth.redirectError(v, 'access_denied', 'The user declined access.').toString() };
    }
    if (config.security.requireVerifiedEmail && !req.user!.email_verified_at) {
      throw new OAuthError('access_denied', 'Verify your email before connecting apps.', 403);
    }
    await this.oauth.grantConsent(req.user!.id, v.client, v.scopes);
    const url = await this.oauth.issueCode(v, req.user!, req.session!);
    return { redirectTo: url.toString() };
  }

  @Post('oauth/token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async token(@Body() body: Record<string, string>, @Req() req: Request, @Meta() meta: RequestMeta) {
    const client = await this.oauth.authenticateClient(req.header('authorization'), body ?? {});
    switch (body?.grant_type) {
      case 'authorization_code':
        return this.oauth.exchangeCode(client, body, meta);
      case 'refresh_token':
        return this.oauth.refresh(client, body);
      default:
        throw new OAuthError('unsupported_grant_type', 'Supported grants: authorization_code, refresh_token.');
    }
  }

  @All('oauth/userinfo')
  @Header('Cache-Control', 'no-store')
  async userinfo(@Req() req: Request) {
    if (!['GET', 'POST'].includes(req.method)) throw new OAuthError('invalid_request', 'Use GET or POST.', 405);
    const { user, scopes } = await this.oauth.readAccessToken(req.header('authorization'));
    return { sub: user.id, ...this.oauth.claims(user, scopes) };
  }

  @Post('oauth/revoke')
  @HttpCode(200)
  async revoke(@Body() body: Record<string, string>, @Req() req: Request) {
    const client = await this.oauth.authenticateClient(req.header('authorization'), body ?? {});
    await this.oauth.revoke(client, body?.token);
    return {};
  }

  @Post('oauth/introspect')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async introspect(@Body() body: Record<string, string>, @Req() req: Request) {
    const client = await this.oauth.authenticateClient(req.header('authorization'), body ?? {});
    return this.oauth.introspect(client, body?.token);
  }

  /** RP-initiated logout: ends the SSO session and returns to the app if it registered that address. */
  @Get('oauth/logout')
  async logout(
    @Query('id_token_hint') hint: string | undefined,
    @Query('post_logout_redirect_uri') redirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Query('client_id') clientId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const resolved = await this.sessions.resolve(this.sessions.readCookie(req));
    if (resolved) await this.sessions.revoke(resolved.session.id);
    this.sessions.clearCookie(res);

    const client = (await this.oauth.clientFromIdTokenHint(hint)) ?? (clientId ? await this.clients.findByClientId(clientId) : null);
    if (client && redirectUri && client.post_logout_redirect_uris.includes(redirectUri)) {
      const url = new URL(redirectUri);
      if (state) url.searchParams.set('state', state);
      return res.redirect(url.toString());
    }
    return res.redirect(`${config.publicUrl}/logged-out${client ? `?app=${encodeURIComponent(client.name)}` : ''}`);
  }

  private async validateForUi(params: AuthorizeParams) {
    try {
      return await this.oauth.validateAuthorize(params);
    } catch (err) {
      if (err instanceof UnsafeAuthorizeError) throw new OAuthError(err.error, err.description);
      if (err instanceof URL) throw new OAuthError(err.searchParams.get('error') ?? 'invalid_request', err.searchParams.get('error_description') ?? '');
      throw err;
    }
  }

  private handleAuthorizeError(err: unknown, res: Response) {
    if (err instanceof URL) return res.redirect(err.toString());
    if (err instanceof UnsafeAuthorizeError) {
      const q = new URLSearchParams({ error: err.error, error_description: err.description });
      return res.redirect(`${config.publicUrl}/error?${q.toString()}`);
    }
    throw err;
  }
}

function authorizePath(params: AuthorizeParams) {
  return `/api/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
}
