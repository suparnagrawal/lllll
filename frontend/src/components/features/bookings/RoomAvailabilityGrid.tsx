import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import type { BookingDetail } from '../../../lib/api/types';

interface RoomAvailabilityGridProps {
  selectedRooms: Array<{ id: number; name: string; buildingName?: string }>;
  roomAvailabilityData: Map<number, any>;
  isLoading: boolean;
  error?: Error | null;
  selectedDate: string;
}

export function RoomAvailabilityGrid({
  selectedRooms,
  roomAvailabilityData,
  isLoading,
  error,
  selectedDate,
}: RoomAvailabilityGridProps) {
  const { user } = useAuth();
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set());

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const toggleBookingDetails = (bookingId: number) => {
    const newSet = new Set(expandedBookings);
    if (newSet.has(bookingId)) {
      newSet.delete(bookingId);
    } else {
      newSet.add(bookingId);
    }
    setExpandedBookings(newSet);
  };

  const getBookingClass = (booking: BookingDetail) => {
    if (booking.visibilityLevel === 'full') {
      return 'bg-blue-100 border-blue-300 text-blue-900';
    }
    return 'bg-gray-100 border-gray-300 text-gray-600';
  };

  const isBookingInSlot = (
    booking: BookingDetail,
    slotTime: string,
    selectedDate: string
  ): boolean => {
    const bookingStart = new Date(booking.startAt);
    const bookingEnd = new Date(booking.endAt);
    const slotStart = new Date(`${selectedDate}T${slotTime}`);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    return bookingStart < slotEnd && bookingEnd > slotStart;
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-900">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Error loading availability</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-2 animate-spin">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
          <p className="text-gray-600">Loading availability...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="card">
      <div className="card-header">
        <h3>Availability Grid</h3>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Grid Header */}
          <div className={`grid gap-px bg-gray-200`} style={{
            gridTemplateColumns: `100px repeat(${selectedRooms.length}, minmax(150px, 1fr))`
          }}>
            <div className="bg-gray-50 p-3 font-semibold text-sm text-gray-700 border-r border-gray-200">
              Time
            </div>
            {selectedRooms.map((room) => (
              <div
                key={room.id}
                className="bg-gray-50 p-3 font-semibold text-sm text-gray-700 border-r border-gray-200"
              >
                {room.buildingName} - {room.name}
              </div>
            ))}
          </div>

          {/* Grid Rows (Time slots) */}
          {timeSlots.map((timeSlot, idx) => (
            <div
              key={timeSlot}
              className={`grid gap-px`}
              style={{
                gridTemplateColumns: `100px repeat(${selectedRooms.length}, minmax(150px, 1fr))`,
                backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
              }}
            >
              <div className="p-3 text-sm font-medium text-gray-700 border-r border-gray-200 bg-inherit">
                {timeSlot}
              </div>

              {selectedRooms.map((room) => {
                const roomData = roomAvailabilityData.get(room.id);
                const bookingsInSlot = roomData?.bookings
                  ? (roomData.bookings as BookingDetail[]).filter((b) =>
                      isBookingInSlot(b, timeSlot, selectedDate)
                    )
                  : [];

                return (
                  <div
                    key={`${room.id}-${timeSlot}`}
                    className="p-2 border-r border-gray-200 relative min-h-[80px]"
                  >
                    {bookingsInSlot.length > 0 ? (
                      <div className="space-y-1">
                        {bookingsInSlot.map((booking) => (
                          <div
                            key={booking.id}
                            className={`p-2 rounded border text-xs cursor-pointer transition-colors hover:opacity-80 ${getBookingClass(
                              booking
                            )}`}
                            onClick={() => toggleBookingDetails(booking.id)}
                          >
                            {booking.visibilityLevel === 'full' ? (
                              <>
                                <p className="font-semibold">
                                  {booking.activityName || 'Booking'}
                                </p>
                                {expandedBookings.has(booking.id) && (
                                  <div className="mt-2 pt-2 border-t border-current text-xs space-y-1">
                                    <p>
                                      <strong>By:</strong> {booking.bookedBy}
                                    </p>
                                    <p>
                                      <strong>Purpose:</strong> {booking.purpose}
                                    </p>
                                    {booking.contactInfo && (
                                      <p>
                                        <strong>Contact:</strong>{' '}
                                        {booking.contactInfo}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="font-semibold">Not Available</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-gray-400">
                        Available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded mt-4">
          <p>Logged in as: {user.name} ({user.role})</p>
        </div>
      )}
    </div>
  );
}
