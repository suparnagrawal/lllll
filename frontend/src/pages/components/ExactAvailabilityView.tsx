import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader } from "lucide-react";
import { BuildingSelector } from "./BuildingSelector";
import { RoomAvailabilityCard } from "./RoomAvailabilityCard";
import { useBuildings } from "../../hooks/useBuildings";
import { useRooms } from "../../hooks/useRooms";
import { useAuth } from "../../auth/AuthContext";
import { getUserBuildingAssignments, getRoomDayTimeline } from "../../lib/api";
import type { Room, TimelineSegment } from "../../lib/api";
import type { BookingRequestPrefill } from "../bookingAvailabilityBridge";

type ExactAvailabilityViewProps = {
  selectedDates: string[];
  timeRangeStart: string;
  timeRangeEnd: string;
};

interface RoomWithBuilding extends Room {
  buildingName: string;
}

interface RoomAvailabilityStatus {
  roomId: number;
  isFullyAvailable: boolean;
  availableFrom: string;
  availableTo: string;
}

export function ExactAvailabilityView({
  selectedDates,
  timeRangeStart,
  timeRangeEnd,
}: ExactAvailabilityViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.role === "STAFF";
  const isAdmin = user?.role === "ADMIN";
  const canViewBookingsPage = isStaff || isAdmin;

  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([]);
  const [staffBuildingIds, setStaffBuildingIds] = useState<number[]>([]);
  const [roomAvailabilityMap, setRoomAvailabilityMap] = useState<
    Map<string, RoomAvailabilityStatus>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: buildings = [] } = useBuildings();
  const { data: allRooms = [] } = useRooms(undefined, true);

  // Load staff's assigned buildings
  useEffect(() => {
    if (!isStaff || !user) return;

    const loadStaffBuildings = async () => {
      try {
        const response = await getUserBuildingAssignments(user.id);
        setStaffBuildingIds(response.buildingIds);
      } catch (error) {
        console.error("Failed to load staff building assignments:", error);
        setStaffBuildingIds([]);
      }
    };

    void loadStaffBuildings();
  }, [isStaff, user]);

  // Filter buildings based on user role
  const visibleBuildings = isStaff
    ? buildings.filter((b) => staffBuildingIds.includes(b.id))
    : buildings;

  // Get rooms for selected buildings
  const selectedRooms: RoomWithBuilding[] = allRooms
    .filter((r) => selectedBuildingIds.includes(r.buildingId))
    .map((r) => ({
      ...r,
      buildingName:
        buildings.find((b) => b.id === r.buildingId)?.name || "Unknown Building",
    }))
    .sort((a, b) => {
      // Sort by building name, then room name
      const buildingCompare = a.buildingName.localeCompare(b.buildingName);
      return buildingCompare === 0 ? a.name.localeCompare(b.name) : buildingCompare;
    });

  // Fetch availability for all selected rooms across all selected dates
  useEffect(() => {
    if (!hasSearched || selectedRooms.length === 0 || selectedDates.length === 0) {
      setRoomAvailabilityMap(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchAvailability = async () => {
      try {
        const availabilityMap = new Map<string, RoomAvailabilityStatus>();

        // Fetch availability for each room and date combination
        const queries = selectedRooms.flatMap((room) =>
          selectedDates.map((date) => ({
            roomId: room.id,
            date,
            room,
          }))
        );

        // Process queries with batching to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < queries.length; i += batchSize) {
          const batch = queries.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async ({ roomId, date, room }) => {
              try {
                const data = await getRoomDayTimeline(roomId, date);

                // Check if room is fully available for the time range
                const isFullyAvailable = isRoomFullyAvailableForRange(
                  data.segments,
                  timeRangeStart,
                  timeRangeEnd,
                  date
                );

                const key = `${roomId}`;

                // Update map if this is the first date or if we found availability
                if (!availabilityMap.has(key) || isFullyAvailable) {
                  availabilityMap.set(key, {
                    roomId,
                    isFullyAvailable: availabilityMap.get(key)?.isFullyAvailable
                      ? true
                      : isFullyAvailable,
                    availableFrom: timeRangeStart,
                    availableTo: timeRangeEnd,
                  });
                }
              } catch (err) {
                console.error(`Error fetching availability for room ${room.name}:`, err);
              }
            })
          );
        }

        // Set status for all rooms (even if not found in map, mark as unavailable)
        selectedRooms.forEach((room) => {
          const key = `${room.id}`;
          if (!availabilityMap.has(key)) {
            availabilityMap.set(key, {
              roomId: room.id,
              isFullyAvailable: false,
              availableFrom: "",
              availableTo: "",
            });
          }
        });

        setRoomAvailabilityMap(availabilityMap);
      } catch (err) {
        console.error("Error fetching availability:", err);
        setError("Failed to load room availability. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAvailability();
  }, [selectedRooms, selectedDates, timeRangeStart, timeRangeEnd, hasSearched]);

  const handleRoomClick = (room: RoomWithBuilding) => {
    const startTime = `${selectedDates[0]}T${timeRangeStart}:00`;
    const endTime = `${selectedDates[0]}T${timeRangeEnd}:00`;

    const prefill: BookingRequestPrefill = {
      roomId: room.id,
      startAt: startTime,
      endAt: endTime,
      buildingId: room.buildingId,
    };

    if (canViewBookingsPage) {
      // Staff and Admin go to Bookings page
      navigate("/bookings", { state: { prefill } });
    } else {
      // Student and Faculty go to Booking Requests page
      navigate("/requests", { state: { prefill } });
    }
  };

  const handleProceedSearch = () => {
    if (selectedBuildingIds.length === 0) {
      setError("Please select at least one building");
      return;
    }
    setHasSearched(true);
  };

  // Group rooms by building
  const groupedRooms = selectedRooms.reduce(
    (acc, room) => {
      if (!acc[room.buildingName]) {
        acc[room.buildingName] = [];
      }
      acc[room.buildingName].push(room);
      return acc;
    },
    {} as Record<string, RoomWithBuilding[]>
  );

  return (
    <div className="space-y-6">
      {/* Building Selector Card */}
      <div className="card">
        <div className="card-header">
          <h3>Select Buildings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Choose buildings to see room availability
          </p>
        </div>
        <div className="p-6 space-y-4">
          <BuildingSelector
            buildings={visibleBuildings}
            selectedBuildingIds={selectedBuildingIds}
            onSelectionChange={setSelectedBuildingIds}
          />
          
          {/* Proceed Button */}
          <button
            onClick={handleProceedSearch}
            disabled={selectedBuildingIds.length === 0}
            className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Search Availability
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-red-900">Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && hasSearched && (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-blue-500 mr-3" size={24} />
          <span className="text-gray-600">Loading room availability...</span>
        </div>
      )}

      {/* Rooms by Building - Only show after search */}
      {hasSearched && !isLoading && selectedBuildingIds.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedRooms).map(([buildingName, rooms]) => (
            <div key={buildingName}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{buildingName}</h3>
              {rooms.length === 0 ? (
                <p className="text-gray-500 text-sm">No rooms in this building</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => {
                    const availability = roomAvailabilityMap.get(`${room.id}`);
                    return (
                      <RoomAvailabilityCard
                        key={room.id}
                        room={room}
                        buildingName={buildingName}
                        isFullyAvailable={availability?.isFullyAvailable ?? false}
                        availableFrom={availability?.availableFrom ?? ""}
                        availableTo={availability?.availableTo ?? ""}
                        onClick={() => handleRoomClick(room)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Utility function to check if a room is fully available for a time range
function isRoomFullyAvailableForRange(
  segments: TimelineSegment[],
  timeRangeStart: string,
  timeRangeEnd: string,
  date: string
): boolean {
  // Parse time range (HH:MM format)
  const [startHour, startMin] = timeRangeStart.split(":").map(Number);
  const [endHour, endMin] = timeRangeEnd.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Convert date to a reference point
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  // Check if all segments in the time range are free
  for (const segment of segments) {
    const segmentStart = new Date(segment.start);
    const segmentEnd = new Date(segment.end);

    const segmentStartMin =
      (segmentStart.getTime() - dayStart.getTime()) / (1000 * 60);
    const segmentEndMin = (segmentEnd.getTime() - dayStart.getTime()) / (1000 * 60);

    // Check if this segment overlaps with our desired time range
    if (segmentStartMin < endMinutes && segmentEndMin > startMinutes) {
      // If it's not free, room is not fully available
      if (segment.status !== "free") {
        return false;
      }
    }
  }

  return true;
}
