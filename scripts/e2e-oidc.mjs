// End-to-end check of the OIDC flow against a running auth service.
// Usage: BASE=http://localhost:4100 ORIGIN=http://localhost:3000 node scripts/e2e-oidc.mjs
// Needs a fresh database, and PROMOTE_CMD to mark the first user verified+admin
// (e.g. a psql command), because emails are not delivered in tests.
import { createHash, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://localhost:4100';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000';
const API = `${BASE}/api`;
let cookie = '';
let passed = 0;

function check(cond, label) {
  if (!cond) {
    console.error(`FAIL  ${label}`);
    process.exit(1);
  }
  passed++;
  console.log(`ok    ${label}`);
}

async function call(method, path, { body, form, headers = {}, auth, redirect = 'manual', useCookie = true } = {}) {
  const h = { origin: ORIGIN, ...headers };
  if (useCookie && cookie) h.cookie = cookie;
  if (auth) h.authorization = auth;
  let payload;
  if (form) {
    h['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    h['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, { method, headers: h, body: payload, redirect });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && useCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, location: res.headers.get('location') };
}

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

const cfg = await call('GET', '/auth/config');
check(cfg.status === 200 && cfg.json.allowSignup === true, 'public config');

const email = `admin@test.dev`;
const password = 'correct horse battery';
const signup = await call('POST', '/auth/signup', { body: { email, name: 'Ada Admin', password } });
check(signup.status === 201 && cookie.includes('tj_session'), 'signup sets session cookie');

const weak = await call('POST', '/auth/signup', { body: { email: 'x@test.dev', name: 'X', password: 'short' }, useCookie: false });
check(weak.status === 400, 'weak password rejected');

const csrf = await call('POST', '/auth/login', { body: { email, password }, headers: { origin: 'https://evil.example' } });
check(csrf.status === 403, 'cross-origin POST rejected');

if (process.env.PROMOTE_CMD) execSync(process.env.PROMOTE_CMD, { stdio: 'inherit' });

const me = await call('GET', '/auth/me');
check(me.status === 200 && me.json.user.role === 'admin' && me.json.user.emailVerified, 'me: verified admin');

const app = await call('POST', '/admin/apps', {
  body: {
    name: 'Test App',
    redirectUris: ['http://localhost:9999/cb'],
    postLogoutRedirectUris: ['http://localhost:9999/bye'],
    allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
  },
});
check(app.status === 201 && app.json.clientSecret?.startsWith('tjs_'), 'admin creates confidential app');
const { clientId } = app.json.app;
const secret = app.json.clientSecret;
const basic = 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64');

const badRedirect = await call('GET', `/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=https://evil.example/cb&code_challenge=x&code_challenge_method=S256`);
check(badRedirect.status === 302 && badRedirect.location.includes('/error?'), 'unregistered redirect_uri -> our error page');

const p = pkce();
const q = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: 'http://localhost:9999/cb',
  scope: 'openid profile email offline_access',
  state: 'st4te',
  nonce: 'n0nce',
  code_challenge: p.challenge,
  code_challenge_method: 'S256',
});

const anon = await call('GET', `/oauth/authorize?${q}`, { useCookie: false });
check(anon.status === 302 && anon.location.includes('/login?return_to='), 'no session -> login page');

const noPkce = new URLSearchParams(q);
noPkce.delete('code_challenge');
const np = await call('GET', `/oauth/authorize?${noPkce}`);
check(np.status === 302 && np.location.startsWith('http://localhost:9999/cb?error=invalid_request'), 'missing PKCE -> error to client');

const toConsent = await call('GET', `/oauth/authorize?${q}`);
check(toConsent.status === 302 && toConsent.location.includes('/consent?'), 'third-party app -> consent page');

const info = await call('GET', `/oauth/consent?${q}`);
check(info.status === 200 && info.json.client.name === 'Test App' && info.json.scopes.length === 4, 'consent info');

const approve = await call('POST', '/oauth/consent', { body: { ...Object.fromEntries(q), approve: true } });
check(approve.status === 200 && approve.json.redirectTo.includes('code='), 'consent approve returns code');
const code = new URL(approve.json.redirectTo).searchParams.get('code');
check(new URL(approve.json.redirectTo).searchParams.get('state') === 'st4te', 'state echoed');

const again = await call('GET', `/oauth/authorize?${q}`);
check(again.status === 302 && again.location.startsWith('http://localhost:9999/cb?code='), 'consent remembered -> straight back with code');

const badPkce = await call('POST', '/oauth/token', {
  form: { grant_type: 'authorization_code', code: new URL(again.location).searchParams.get('code'), redirect_uri: 'http://localhost:9999/cb', code_verifier: 'wrong'.repeat(10) },
  auth: basic,
  useCookie: false,
});
check(badPkce.status === 400 && badPkce.json.error === 'invalid_grant', 'wrong PKCE verifier rejected');

const badSecret = await call('POST', '/oauth/token', {
  form: { grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:9999/cb', code_verifier: p.verifier },
  auth: 'Basic ' + Buffer.from(`${clientId}:nope`).toString('base64'),
  useCookie: false,
});
check(badSecret.status === 401 && badSecret.json.error === 'invalid_client', 'wrong client secret rejected');

const tok = await call('POST', '/oauth/token', {
  form: { grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:9999/cb', code_verifier: p.verifier },
  auth: basic,
  useCookie: false,
});
check(tok.status === 200 && tok.json.access_token && tok.json.id_token && tok.json.refresh_token, 'code -> access, id and refresh tokens');

const reuse = await call('POST', '/oauth/token', {
  form: { grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:9999/cb', code_verifier: p.verifier },
  auth: basic,
  useCookie: false,
});
check(reuse.status === 400, 'authorization code is single-use');

const idClaims = JSON.parse(Buffer.from(tok.json.id_token.split('.')[1], 'base64url').toString());
check(idClaims.nonce === 'n0nce' && idClaims.email === email && idClaims.email_verified === true && idClaims.aud === clientId, 'id_token claims');

const ui = await call('GET', '/oauth/userinfo', { auth: `Bearer ${tok.json.access_token}`, useCookie: false });
check(ui.status === 200 && ui.json.email === email && ui.json.name === 'Ada Admin', 'userinfo');

const disc = await call('GET', '/.well-known/openid-configuration', { useCookie: false });
const jwks = await call('GET', '/oauth/jwks', { useCookie: false });
check(disc.json.issuer === `${ORIGIN}/api` && jwks.json.keys[0].kty === 'RSA' && !jwks.json.keys[0].d, 'discovery + public-only JWKS');

const r1 = await call('POST', '/oauth/token', { form: { grant_type: 'refresh_token', refresh_token: tok.json.refresh_token }, auth: basic, useCookie: false });
check(r1.status === 200 && r1.json.refresh_token !== tok.json.refresh_token, 'refresh rotates token');

const replay = await call('POST', '/oauth/token', { form: { grant_type: 'refresh_token', refresh_token: tok.json.refresh_token }, auth: basic, useCookie: false });
check(replay.status === 400, 'replayed refresh token rejected');

const r2 = await call('POST', '/oauth/token', { form: { grant_type: 'refresh_token', refresh_token: r1.json.refresh_token }, auth: basic, useCookie: false });
check(r2.status === 400, 'replay revoked the whole family');

const intro = await call('POST', '/oauth/introspect', { form: { token: tok.json.access_token }, auth: basic, useCookie: false });
check(intro.status === 200 && intro.json.active === true && intro.json.sub === me.json.user.id, 'introspect access token');

const apps = await call('GET', '/account/apps');
check(apps.status === 200 && apps.json.some((a) => a.name === 'Test App'), 'connected apps listed');

const sessions = await call('GET', '/account/sessions');
check(sessions.status === 200 && sessions.json.length === 1 && sessions.json[0].current, 'session list');

for (let i = 0; i < 8; i++) await call('POST', '/auth/login', { body: { email, password: 'wrong password!!' }, useCookie: false });
const locked = await call('POST', '/auth/login', { body: { email, password }, useCookie: false });
check(locked.status === 401 && /Too many/.test(locked.json.message), 'account locks after repeated failures');

const forgot = await call('POST', '/auth/forgot-password', { body: { email: 'nobody@test.dev' }, useCookie: false });
check(forgot.status === 200, 'forgot-password does not reveal unknown emails');

const logout = await call('GET', `/oauth/logout?id_token_hint=${tok.json.id_token}&post_logout_redirect_uri=${encodeURIComponent('http://localhost:9999/bye')}&state=x`);
check(logout.status === 302 && logout.location === 'http://localhost:9999/bye?state=x', 'RP-initiated logout redirects back');

const after = await call('GET', '/auth/me');
check(after.status === 401, 'session ended after logout');

const deadToken = await call('GET', '/oauth/userinfo', { auth: `Bearer ${tok.json.access_token}`, useCookie: false });
check(deadToken.status === 401, 'access token stops working when its session ends');

console.log(`\nAll ${passed} checks passed.`);
