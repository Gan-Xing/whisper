// app/[lang]/layout.tsx
import { ReactNode } from 'react';
import "@/globals.css";

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'zh' }];
}

export default function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang}>
      <body>{children}</body>
    </html>
  );
}
