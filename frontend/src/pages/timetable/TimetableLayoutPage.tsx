import { NavLink, Outlet } from 'react-router-dom';

const TIMETABLE_NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '.', label: 'All-in-One', end: true },
  { to: 'structure', label: 'Structure' },
  { to: 'imports', label: 'Imports' },
  { to: 'processed', label: 'Processed Rows' },
  { to: 'workspace', label: 'Change Workspace' },
];

export default function TimetableLayoutPage() {
  return (
    <div className="pb-4">
      <section className="mx-4 mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Timetable Module</h2>
        <p className="mt-1 text-sm text-gray-600">
          Modular navigation is now enabled. Existing features remain available in the All-in-One view while split pages are phased in.
        </p>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Timetable sections">
          {TIMETABLE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive
                  ? 'rounded-md border border-blue-500 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700'
                  : 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet />
    </div>
  );
}
