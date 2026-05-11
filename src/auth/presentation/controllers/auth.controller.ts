import { Controller, Get, Post, Body, UseGuards, Req, Query, Res, Inject, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../../application/auth.service';
import { JwtAuthGuard } from '../../presentation/guards/jwt.guard';
// import { AppsService } from 'src/apps/apps.service';
import { OAuthService } from '../../application/oauth.service';
import { TokenService } from '../../application/token.service';
import type { AppRepository } from 'src/apps/domain/app.repository';
import { Logger } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  private logger = new Logger(AuthController.name);
  constructor(
    private authService: AuthService,
    // @Inject('AppRepository')
    // private appRepo: AppRepository,
    private oauthService: OAuthService,
    private tokenService: TokenService,
  ) {}

  @Post('signup')
  signup(@Body() body) {
    this.logger.log(
    `Signup attempt for ${body.email}`
    );
    return this.authService.signup(
      body.email,
      body.password,
      body.name,
    );
  }

//   @Post('login')
//   async login(@Body() body, @Res() res: Response) {
//       const user = await this.authService.validate(body.email, body.password);

//       const state = body.state;

//       if (!user) throw new UnauthorizedException('User Doesnt exist');
//       // Generate authorization code
//       const code = await this.oauthService.generateCode(
//         user.id,
//         body.client_id,
//         body.redirect_uri,
//       );

//     //   await this.authService.saveCode(user.id, body.client_id, body.redirect_uri, code);

//       // return res.redirect(
//       //     `${body.redirect_uri}?code=${code}&state=${state}`
//       // );
//       return {
//   redirect_to: `${body.redirect_uri}?code=${code}&state=${state}`
// };
//   }

  @Post('login')
  async login(@Body() body) {
    this.logger.log(
    `Login attempt for ${body.email}`
    );
    
    const user = await this.authService.validate(
      body.email,
      body.password,
    );

    const state = body.state;

    if (!user) {
       this.logger.warn(
      `Invalid credentials for ${body.email}`
    );
      throw new UnauthorizedException('User Doesnt exist');
    }

    const code = await this.oauthService.generateCode(
      user.id,
      body.client_id,
      body.redirect_uri,
      body.code_challenge,
      body.code_challenge_method,
    );

    this.logger.log(
    `OAuth code generated for user ${user.id}`
  );

    return {
      redirect_to: `${body.redirect_uri}?code=${code}&state=${state}`,
    };
  }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@Req() req) {
        return this.authService.getProfile(req.user.sub);
    }

    @Post('refresh')
    async refresh(@Body() body) {
        return this.tokenService.refreshToken(body.refresh_token);
    }

    @Post('logout')
    async logout(@Body() body) {
        return this.tokenService.logout(body.refresh_token, body.access_token);
    }

    @Get('authorize')
    async authorize(
        @Query('client_id') clientId: string,
        @Query('redirect_uri') redirectUri: string,
        @Query('state') state: string,
        @Query('code_challenge') codeChallenge: string,
        @Query('code_challenge_method') codeChallengeMethod: string,
        @Res() res: Response,
    ) {
        this.logger.log(`Received authorize request`);
        await this.oauthService.validateClient(clientId, redirectUri);
        if (!state) {
          throw new UnauthorizedException('Missing state');
        }

        // const app = await this.appRepo.findByClientId(clientId);

        // if (!app) {
        //     throw new UnauthorizedException('Invalid client');
        // }

        // // Validate redirect URI
        // if (app.redirect_uri !== redirectUri) {
        //     throw new UnauthorizedException('Invalid redirect URI');
        // }

        // return res.redirect(`/auth/login?client_id=${clientId}&redirect_uri=${redirectUri}`);
        // return res.redirect(
        //     `http://localhost:3001/login?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`
        // );
      const frontendUrl = process.env.AUTH_FRONTEND_URL;
      const loginRoute = process.env.AUTH_FRONTEND_LOGIN_ROUTE;

      return res.redirect(
        `${frontendUrl}${loginRoute}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=${encodeURIComponent(codeChallengeMethod)}`
      );
    }

    @Post('token')
    async token(@Body() body) {
      this.logger.log(`Received token request`);
        // const { code, client_id, client_secret, redirect_uri} = body;
        // return this.authService.exchangeCode(code, client_id, client_secret, redirect_uri);
        return this.oauthService.exchangeCode(
            body.code,
            body.client_id,
            body.client_secret,
            body.redirect_uri,
            body.code_verifier,
        );
    }

  //   @Get('login')
  //   showLogin(
  //       @Query('client_id') clientId: string,
  //       @Query('redirect_uri') redirectUri: string,
  //       @Query('state') state: string,
  //       @Res() res: Response,
  //   ) {
  //       return res.send(`
  //   <html>
  //     <body>
  //       <h2>Login</h2>
  //       <form method="POST" action="/auth/login">
  //         <input type="hidden" name="client_id" value="${clientId}" />
  //         <input type="hidden" name="redirect_uri" value="${redirectUri}" />
  //         <input type="hidden" name="state" value="${state}" />

  //         <input name="email" placeholder="Email" />
  //         <input name="password" type="password" placeholder="Password" />

  //         <button type="submit">Login</button>
  //       </form>
  //     </body>
  //   </html>
  // `);
  //   }


  @Post('session')
  async session(@Body() body) {
    this.logger.log(
      `Session login attempt for ${body.email}`,
    );

    const user = await this.authService.validate(
      body.email,
      body.password,
    );

    if (!user) {
      this.logger.warn(
        `Invalid credentials for ${body.email}`,
      );

      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    return this.tokenService.createSession(user);
  }
}