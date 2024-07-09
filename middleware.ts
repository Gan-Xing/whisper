// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { match as localeMatcher } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const locales = ['en', 'zh'];
const defaultLocale = 'zh';

function getLocale(request: NextRequest) {
  const negotiator = new Negotiator({ headers: { 'accept-language': request.headers.get('accept-language') || '' } });
  const languages = negotiator.languages();
  return localeMatcher(languages, locales, defaultLocale);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
