import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CalendarDays, Search, Settings2, ShieldCheck,
  ChevronRight, ChevronLeft, CheckCircle, XCircle,
  AlertTriangle, FileText, Upload, MapPin, Clock,
  UserCheck, Users,
} from 'lucide-react';

// ======================================================
// Mock Data
// ======================================================

const MOCK_ROOMS = [
  { id: 1, name: 'Room 101', type: 'Classroom', capacity: 40, status: 'available', equipment: ['Projector', 'Whiteboard'] },
  { id: 2, name: 'Lecture Hall 2', type: 'Lecture Hall', capacity: 120, status: 'occupied', equipment: ['Projector', 'Mic'] },
  { id: 3, name: 'Lab 204', type: 'Lab', capacity: 30, status: 'available', equipment: ['Computers', 'Projector'] },
  { id: 4, name: 'Seminar Room A', type: 'Seminar', capacity: 25, status: 'available', equipment: ['TV Screen'] },
  { id: 5, name: 'Lecture Hall 3', type: 'Lecture Hall', capacity: 200, status: 'occupied', equipment: ['Projector', 'Mic', 'Recording'] },
  { id: 6, name: 'Lab 301', type: 'Lab', capacity: 30, status: 'available', equipment: ['Computers'] },
];

const MOCK_TIMETABLE = [
  { id: 1, course: 'CS101', section: 'A', instructor: 'Dr. Mehta', day: 'Monday', time: '09:00–10:00', resolvedRoom: 'Room 101', status: 'ok' as const },
  { id: 2, course: 'EE201', section: 'B', instructor: 'Dr. Kapoor', day: 'Monday', time: '09:00–10:00', resolvedRoom: null, status: 'ambiguous' as const },
  { id: 3, course: 'MA301', section: 'A', instructor: 'Dr. Singh', day: 'Tuesday', time: '11:00–12:00', resolvedRoom: 'Lab 204', status: 'ok' as const },
  { id: 4, course: 'CS205', section: 'A', instructor: 'Dr. Patel', day: 'Wednesday', time: '14:00–15:00', resolvedRoom: null, status: 'ambiguous' as const },
  { id: 5, course: 'ME101', section: 'C', instructor: 'Dr. Joshi', day: 'Thursday', time: '10:00–11:00', resolvedRoom: 'Room 101', status: 'ok' as const },
];

const ROOM_ASSIGN_OPTIONS = ['Room 101', 'Room 102', 'Lab 204', 'Seminar Room A', 'Lecture Hall 2'];

// ======================================================
// Shared Components
// ======================================================

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_FACULTY: { label: 'Pending Faculty', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    PENDING_STAFF:   { label: 'Pending Staff',   cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    APPROVED:        { label: 'Approved',         cls: 'bg-green-100 text-green-700 border border-green-200' },
    REJECTED:        { label: 'Rejected',         cls: 'bg-red-100 text-red-700 border border-red-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ======================================================
// Booking Flow (4 steps)
// ======================================================

type BookingStep = 0 | 1 | 2 | 3;

function BookingFlow({ step, onAction }: { step: BookingStep; onAction: () => void }) {
  if (step === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <FileText className="w-4 h-4" /> New Booking Request
        </p>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Building</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Academic Block A</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Room</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Lecture Hall 3</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Tue, 15 Oct 2024</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Time</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">10:00 AM – 12:00 PM</div>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Purpose</p>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Guest Lecture — Dr. R. Sharma (AI & ML)</div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Requested By</p>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Dr. Priya Patel · Computer Science</div>
          </div>
        </div>
        <button
          onClick={onAction}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          Submit Booking Request <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <UserCheck className="w-4 h-4" /> Faculty Review Inbox
        </p>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="font-semibold text-slate-800">REQ-2024-0142</p>
              <p className="text-xs text-slate-500 mt-0.5">From: Dr. Priya Patel · CS Dept</p>
            </div>
            <StatusBadge status="PENDING_FACULTY" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-600 mb-4">
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Lecture Hall 3</div>
            <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> 15 Oct 2024</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> 10:00–12:00</div>
          </div>
          <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5 text-sm text-slate-700 mb-4">
            Guest Lecture — Dr. R. Sharma (AI & ML)
          </div>
          <div className="flex gap-3">
            <button
              onClick={onAction}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" /> Approve & Forward to Staff
            </button>
            <button className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <Users className="w-4 h-4" /> Staff Approval Queue
        </p>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="font-semibold text-slate-800">REQ-2024-0142</p>
              <p className="text-xs text-slate-500 mt-0.5">Forwarded by Faculty · CS Dept</p>
            </div>
            <StatusBadge status="PENDING_STAFF" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-600 mb-4">
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Lecture Hall 3</div>
            <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> 15 Oct 2024</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> 10:00–12:00</div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 mb-4">
            ℹ️ Room is available for this slot. No scheduling conflicts detected.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onAction}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" /> Confirm & Approve Booking
            </button>
            <button className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Confirmed
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="font-bold text-green-800 text-lg mb-1">Booking Confirmed!</h3>
        <p className="text-green-700 text-sm mb-5">REQ-2024-0142 is now an active booking on the calendar.</p>
        <div className="bg-white border border-green-200 rounded-xl p-4 text-left space-y-2.5 text-sm">
          {[
            ['Room', 'Lecture Hall 3, Academic Block A'],
            ['Date', 'Tue, 15 Oct 2024'],
            ['Time', '10:00 AM – 12:00 PM'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-800">{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Status</span>
            <StatusBadge status="APPROVED" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================================================
// Availability Flow (3 steps)
// ======================================================

function AvailabilityFlow({
  step,
  selectedRoom,
  onSelectRoom,
  onAction,
}: {
  step: number;
  selectedRoom: number | null;
  onSelectRoom: (id: number) => void;
  onAction: () => void;
}) {
  if (step === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <Search className="w-4 h-4" /> Search Availability
        </p>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Building</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Academic Block A</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">15 Oct 2024</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">From</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">10:00 AM</div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">To</p>
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">12:00 PM</div>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Required Equipment</p>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-800">Projector</div>
          </div>
        </div>
        <button
          onClick={onAction}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> Check Availability
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
          6 rooms · Academic Block A · 15 Oct · 10:00–12:00
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_ROOMS.map(room => (
            <button
              key={room.id}
              onClick={() => {
                if (room.status === 'available') {
                  onSelectRoom(room.id);
                  onAction();
                }
              }}
              disabled={room.status === 'occupied'}
              className={`text-left p-3 rounded-xl border transition-all ${
                room.status === 'available'
                  ? 'border-green-200 bg-green-50 hover:border-green-400 hover:shadow-sm cursor-pointer'
                  : 'border-slate-200 bg-slate-50 opacity-55 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-semibold text-slate-800 text-sm leading-tight">{room.name}</span>
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium ${room.status === 'available' ? 'bg-green-200 text-green-800' : 'bg-red-100 text-red-700'}`}>
                  {room.status === 'available' ? 'Free' : 'Occupied'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{room.type} · Cap. {room.capacity}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{room.equipment.join(', ')}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center pt-1">Click any green room to continue</p>
      </div>
    );
  }

  // Step 2: Selected room detail
  const room = MOCK_ROOMS.find(r => r.id === selectedRoom) ?? MOCK_ROOMS[0];
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-bold text-slate-800 text-lg">{room.name}</p>
            <p className="text-sm text-slate-500">{room.type} · Capacity {room.capacity}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-semibold whitespace-nowrap">Available</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {room.equipment.map(eq => (
            <span key={eq} className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600">{eq}</span>
          ))}
        </div>
        <div className="bg-white border border-green-100 rounded-lg px-3 py-2.5 text-sm text-slate-700 mb-4">
          <span className="font-medium">Slot:</span> 15 Oct 2024, 10:00 AM – 12:00 PM — No conflicts detected.
        </div>
        <button
          onClick={onAction}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
        >
          Proceed to Book This Room
        </button>
      </div>
    </div>
  );
}

// ======================================================
// Timetable Flow (4 steps)
// ======================================================

function TimetableFlow({
  step,
  resolutions,
  onResolve,
  onAction,
}: {
  step: number;
  resolutions: Record<number, string>;
  onResolve: (id: number, room: string) => void;
  onAction: () => void;
}) {
  if (step === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload Timetable CSV
        </p>
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">timetable_oct_2024.csv</p>
          <p className="text-xs text-slate-400 mt-1">89 rows · 12 KB · Uploaded</p>
          <div className="mt-4 bg-white border border-slate-200 rounded-lg p-2">
            <div className="h-2 bg-blue-600 rounded-full w-full" />
          </div>
          <p className="text-xs text-slate-500 mt-2">Processing complete — 89 rows parsed</p>
        </div>
        <button
          onClick={onAction}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          Preview Import <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Import Preview — 5 of 89 rows shown
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          2 rows have an AMBIGUOUS_CLASSROOM conflict. Resolve before committing.
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Course', 'Instructor', 'Day / Time', 'Room', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_TIMETABLE.map(row => (
                <tr key={row.id} className={row.status === 'ambiguous' ? 'bg-amber-50' : ''}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.course} <span className="text-slate-400 font-normal">§{row.section}</span></td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.instructor}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.day} · {row.time}</td>
                  <td className="px-3 py-2">
                    {row.status === 'ok'
                      ? <span className="text-slate-700">{row.resolvedRoom}</span>
                      : <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unresolved</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    {row.status === 'ok'
                      ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">OK</span>
                      : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">AMBIGUOUS</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={onAction}
          className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
        >
          Resolve Conflicts <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === 2) {
    const ambiguousRows = MOCK_TIMETABLE.filter(r => r.status === 'ambiguous');
    const allResolved = ambiguousRows.every(r => resolutions[r.id]);
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Resolve Conflicts ({ambiguousRows.length} remaining)
        </p>
        <div className="space-y-3">
          {ambiguousRows.map(row => (
            <div key={row.id} className="bg-white border border-amber-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{row.course} §{row.section}</p>
                  <p className="text-xs text-slate-500">{row.instructor} · {row.day} · {row.time}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">AMBIGUOUS</span>
              </div>
              <label className="text-xs text-slate-500 block mb-1">Assign Room</label>
              <select
                value={resolutions[row.id] ?? ''}
                onChange={e => onResolve(row.id, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select a room...</option>
                {ROOM_ASSIGN_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {resolutions[row.id] && (
                <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Assigned to {resolutions[row.id]}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onAction}
          disabled={!allResolved}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          Commit Timetable <ChevronRight className="w-4 h-4" />
        </button>
        {!allResolved && (
          <p className="text-xs text-slate-400 text-center">Resolve all conflicts above to continue</p>
        )}
      </div>
    );
  }

  // Step 3: Commit summary
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="font-bold text-green-800 text-lg mb-1">Timetable Committed!</h3>
        <p className="text-green-700 text-sm">All rows processed. Bookings are now active in the system.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wide">
          Commit Summary
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { label: 'Total Rows Processed', value: '89', cls: 'text-slate-800' },
            { label: 'Successfully Committed', value: '87', cls: 'text-green-600' },
            { label: 'Conflicts Resolved', value: '2', cls: 'text-blue-600' },
            { label: 'Skipped / Errors', value: '0', cls: 'text-slate-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className={`font-bold ${cls}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================================================
// Flow config
// ======================================================

const FLOWS = [
  {
    id: 'booking' as const,
    label: 'Booking Flow',
    Icon: FileText,
    steps: ['Submit Request', 'Faculty Review', 'Staff Approval', 'Confirmed'] as const,
    description: 'How a booking request moves from submission through approval.',
  },
  {
    id: 'availability' as const,
    label: 'Availability Search',
    Icon: Search,
    steps: ['Set Filters', 'Browse Rooms', 'Book a Room'] as const,
    description: 'Find a free room in real time by date, time, and equipment.',
  },
  {
    id: 'timetable' as const,
    label: 'Timetable Import',
    Icon: Settings2,
    steps: ['Upload CSV', 'Preview & Detect', 'Resolve Conflicts', 'Commit'] as const,
    description: 'Import a semester timetable, resolve conflicts, and commit.',
  },
];

type FlowId = typeof FLOWS[number]['id'];

// ======================================================
// Main Page
// ======================================================

export default function DemoPage() {
  const { demoLogin } = useAuth();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [activeFlow, setActiveFlow] = useState<FlowId>('booking');
  const [flowSteps, setFlowSteps] = useState<Record<FlowId, number>>({ booking: 0, availability: 0, timetable: 0 });
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, string>>({});

  const handleEnterDemo = async () => {
    try {
      setIsLoading(true);
      await demoLogin('ADMIN');
      navigate('/');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unknown error occurred');
      setIsLoading(false);
    }
  };

  const currentFlow = FLOWS.find(f => f.id === activeFlow)!;
  const currentStep = flowSteps[activeFlow];
  const totalSteps = currentFlow.steps.length;

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setFlowSteps(prev => ({ ...prev, [activeFlow]: prev[activeFlow] + 1 }));
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setFlowSteps(prev => ({ ...prev, [activeFlow]: prev[activeFlow] - 1 }));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">URA System</span>
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Demo</span>
          </div>
          <button
            onClick={handleEnterDemo}
            disabled={isLoading}
            className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            {isLoading ? 'Entering...' : 'Enter Live System →'}
          </button>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero */}
        <section className="relative px-4 pt-16 pb-12 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white" />
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-5">
            See the URA System{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              in Action
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-8 leading-relaxed">
            Step through the real workflows below — booking requests, availability search, and timetable management — all running interactively in your browser. No login needed.
          </p>
          <button
            onClick={handleEnterDemo}
            disabled={isLoading}
            className="px-7 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-semibold shadow-lg shadow-blue-200 inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            {isLoading ? 'Preparing...' : 'Launch Full Demo as Admin'}
          </button>
          <p className="mt-3 text-xs text-slate-400">No account needed · Data resets daily</p>
        </section>

        {/* Interactive Flows */}
        <section className="pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Interactive Walkthrough</h2>
              <p className="text-slate-500 text-sm">Click through each step — these are the real UI flows.</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              {FLOWS.map(flow => {
                const { Icon } = flow;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setActiveFlow(flow.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      activeFlow === flow.id
                        ? 'bg-white shadow-sm text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 hidden sm:block" />
                    <span className="truncate">{flow.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Flow panel */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Panel header with step progress */}
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-slate-900">{currentFlow.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{currentFlow.description}</p>
                  </div>
                  <span className="text-sm text-slate-400 font-medium tabular-nums">
                    Step {currentStep + 1} / {totalSteps}
                  </span>
                </div>
                {/* Step progress bar */}
                <div className="flex gap-1.5 mb-1">
                  {currentFlow.steps.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setFlowSteps(prev => ({ ...prev, [activeFlow]: i }))}
                      className="flex-1"
                      title={label}
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i <= currentStep ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {/* Step label */}
                <p className="text-xs text-blue-600 font-medium mt-2">
                  {currentFlow.steps[currentStep]}
                </p>
              </div>

              {/* Step content */}
              <div className="p-6">
                {activeFlow === 'booking' && (
                  <BookingFlow step={currentStep as BookingStep} onAction={goNext} />
                )}
                {activeFlow === 'availability' && (
                  <AvailabilityFlow
                    step={currentStep}
                    selectedRoom={selectedRoom}
                    onSelectRoom={setSelectedRoom}
                    onAction={goNext}
                  />
                )}
                {activeFlow === 'timetable' && (
                  <TimetableFlow
                    step={currentStep}
                    resolutions={resolutions}
                    onResolve={(id, room) => setResolutions(prev => ({ ...prev, [id]: room }))}
                    onAction={goNext}
                  />
                )}
              </div>

              {/* Navigation footer */}
              <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                <button
                  onClick={goPrev}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                {/* Dot indicators */}
                <div className="flex gap-1.5">
                  {currentFlow.steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === currentStep ? 'bg-blue-500 w-5' : 'bg-slate-200 w-2'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={goNext}
                  disabled={currentStep === totalSteps - 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Enter demo CTA */}
            <div className="mt-10 text-center">
              <p className="text-slate-500 text-sm mb-4">
                Ready to explore the real thing? Jump straight in as Admin — all features, real data.
              </p>
              <button
                onClick={handleEnterDemo}
                disabled={isLoading}
                className="px-7 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors font-semibold inline-flex items-center gap-2"
              >
                {isLoading ? 'Entering System...' : 'Launch Demo Environment →'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
