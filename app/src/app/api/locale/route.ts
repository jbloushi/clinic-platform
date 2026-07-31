import { NextResponse } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';

/**
 * Sets the active locale and returns the visitor to the page they came from.
 *
 * A GET is used so the language switcher works as a plain link with no client
 * JavaScript. `next` is validated as a same-origin relative path so the
 * switcher can't be turned into an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale');
  const next = url.searchParams.get('next');

  if (!isLocale(locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  const target = next && /^\/(?!\/)/.test(next) ? next : '/';
  const response = NextResponse.redirect(new URL(target, url.origin));
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  return response;
}
