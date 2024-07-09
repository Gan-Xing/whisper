// app/[lang]/page.tsx
import { getDictionary } from '@/locales/dictionaries';
import RealTimeTranscription from '@/components/RealTimeTranscription';

interface PageProps {
    params: {
      lang: string;
    };
  }
  export default async function Page({ params: { lang } }: PageProps) {
  const dict = await getDictionary(lang);
  return (
    <div>
      <RealTimeTranscription dictionary={dict} />
    </div>
  );
}
