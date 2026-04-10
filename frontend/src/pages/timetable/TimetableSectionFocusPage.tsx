import { useEffect } from 'react';
import { TimetableBuilderPage } from '../TimetableBuilder';

type TimetableSectionFocusPageProps = {
  sectionId: string;
  title: string;
  description: string;
};

export function TimetableSectionFocusPage(props: TimetableSectionFocusPageProps) {
  const { sectionId, title, description } = props;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sectionId]);

  return (
    <>
      <section className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
        <p className="mt-1 text-sm text-amber-800">{description}</p>
      </section>

      <TimetableBuilderPage />
    </>
  );
}
