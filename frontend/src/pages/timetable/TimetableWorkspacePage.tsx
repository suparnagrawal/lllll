import { useEffect } from 'react';
import { TimetableBuilderPage } from '../TimetableBuilder';

export default function TimetableWorkspacePage() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const timer = window.setTimeout(() => {
      const trigger = document.getElementById('timetable-open-change-workspace') as
        | HTMLButtonElement
        | null;

      if (trigger && !trigger.disabled) {
        trigger.click();
      }

      const structureSection = document.getElementById('timetable-structure-section');
      if (structureSection) {
        structureSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <section className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-900">Change Workspace View</h3>
        <p className="mt-1 text-sm text-amber-800">
          This view focuses on locked-system edits. If the selected slot system is locked, the Edit Structure action opens automatically.
        </p>
      </section>

      <TimetableBuilderPage />
    </>
  );
}
