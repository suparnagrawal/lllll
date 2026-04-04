import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';

// Lazy load pages
// eslint-disable-next-line react-refresh/only-export-components
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
// eslint-disable-next-line react-refresh/only-export-components
const RoomsPage = lazy(() => import('../pages/RoomsPage'));
// eslint-disable-next-line react-refresh/only-export-components
const BookingsPage = lazy(() => import('../pages/BookingsPage'));
// eslint-disable-next-line react-refresh/only-export-components
const BookingRequestsPage = lazy(() => import('../pages/BookingRequestsPage'));
// eslint-disable-next-line react-refresh/only-export-components
const AvailabilityPage = lazy(() => import('../pages/AvailabilityPage'));
// eslint-disable-next-line react-refresh/only-export-components
const UsersPage = lazy(() => import('../pages/UsersPage'));
// eslint-disable-next-line react-refresh/only-export-components
const TimetableBuilderPage = lazy(() => import('../pages/TimetableBuilderPage'));
// eslint-disable-next-line react-refresh/only-export-components
const AuthCallbackPage = lazy(() => import('../pages/AuthCallbackPage'));
// eslint-disable-next-line react-refresh/only-export-components
const AuthSetupPage = lazy(() => import('../pages/AuthSetupPage'));
// eslint-disable-next-line react-refresh/only-export-components
const LoginPage = lazy(() => import('../pages/LoginPage'));
// eslint-disable-next-line react-refresh/only-export-components
const PageLoader = () => (
  <div className="flex items-center justify-center w-full h-screen">
    <div className="text-lg text-gray-500">Loading...</div>
  </div>
);

// eslint-disable-next-line react-refresh/only-export-components
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
      { 
        path: 'rooms', 
        element: <Suspense fallback={<PageLoader />}><RoomsPage /></Suspense> 
      },
      { 
        path: 'bookings', 
        element: <Suspense fallback={<PageLoader />}><BookingsPage /></Suspense> 
      },
      { 
        path: 'requests', 
        element: <Suspense fallback={<PageLoader />}><BookingRequestsPage /></Suspense> 
      },
      { 
        path: 'availability', 
        element: <Suspense fallback={<PageLoader />}><AvailabilityPage /></Suspense> 
      },
      { 
        path: 'users', 
        element: <Suspense fallback={<PageLoader />}><UsersPage /></Suspense> 
      },
      { 
        path: 'timetable', 
        element: <Suspense fallback={<PageLoader />}><TimetableBuilderPage /></Suspense> 
      },
    ],
  },
  {
    path: '/auth/callback',
    element: <Suspense fallback={<PageLoader />}><AuthCallbackPage /></Suspense>,
  },
  {
    path: '/auth/setup',
    element: <Suspense fallback={<PageLoader />}><AuthSetupPage /></Suspense>,
  },
  {
    path: '/login',
    element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
