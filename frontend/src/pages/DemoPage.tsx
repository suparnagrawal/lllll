import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';
import { CalendarDays, CheckCircle2, Search, Settings2, ShieldCheck } from 'lucide-react';

export default function DemoPage() {
  const { demoLogin } = useAuth();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnterDemo = async () => {
    try {
      setIsLoading(true);
      // Admin role has access to all booking, timetable, and management views
      await demoLogin('ADMIN');
      navigate('/');
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation / Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">URA System</span>
          </div>
          <button
            onClick={handleEnterDemo}
            disabled={isLoading}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm shadow-sm"
          >
            {isLoading ? 'Entering Demo...' : 'Enter Demo'}
          </button>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative px-4 pt-24 pb-32 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white"></div>
          <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-900 tracking-tight mb-8">
            Manage Campus Space <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Intelligently.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-12 leading-relaxed">
            Experience the complete University Room Allocation workflow. Explore the automated timetable importer, smart availability search, and comprehensive booking request system—all from a single, unified administrative view.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleEnterDemo}
              disabled={isLoading}
              className="w-full sm:w-auto px-8 py-4 text-lg bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-semibold shadow-lg shadow-blue-200 hover:shadow-blue-300 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              {isLoading ? 'Preparing Demo...' : 'Enter Demo as Admin'}
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-500">No registration required. Data resets daily.</p>
        </section>

        {/* Feature Grid */}
        <section className="py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to see</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                The demo account grants you full access to both end-user booking flows and administrative timetable management tools.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <Settings2 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Timetable Builder</h3>
                <p className="text-slate-600">
                  Import CSV timetables, automatically detect overlapping classes, and resolve room conflicts with an intuitive workspace.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                  <Search className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Availability</h3>
                <p className="text-slate-600">
                  Search for rooms based on specific time slots, building preferences, and equipment requirements in real-time.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Booking Workflow</h3>
                <p className="text-slate-600">
                  Submit ad-hoc booking requests and manage the approval pipeline. See exactly what Faculty and Students experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sneak Peek / Bottom CTA */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Ready to see it in action?</h2>
            <p className="text-lg text-slate-600 mb-10">
              Click the button below to bypass login and enter the system immediately. You'll be logged in as an Administrator, giving you unrestricted access to all features.
            </p>
            <button
              onClick={handleEnterDemo}
              disabled={isLoading}
              className="px-8 py-4 text-lg bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all font-semibold shadow-xl shadow-slate-200"
            >
              {isLoading ? 'Entering System...' : 'Launch Demo Environment'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
