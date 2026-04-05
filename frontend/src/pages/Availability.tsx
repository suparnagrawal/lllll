import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useAvailability } from "../hooks/useAvailability";
import { useBuildings } from "../hooks/useBuildings";
import { useRooms } from "../hooks/useRooms";
import { useAuth } from "../auth/AuthContext";
import { getUserBuildingAssignments } from "../lib/api";
import type { AvailabilityBuilding, Room } from "../lib/api";
import { RoomAvailabilityGrid } from "../components/features/bookings/RoomAvailabilityGrid";
import { DateInput } from "../components/DateInput";

type AvailabilityPageProps = {
  canRequestBooking?: boolean;
  prefill?: any;
  onPrefillApplied?: () => void;
  onRequestBooking?: (prefill: any) => void;
};

export function AvailabilityPage({
  canRequestBooking: _canRequestBooking,
  prefill: _prefill,
  onPrefillApplied: _onPrefillApplied,
  onRequestBooking: _onRequestBooking,
}: AvailabilityPageProps) {
  const { user } = useAuth();
  const isStaff = user?.role === "STAFF";

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [staffBuildingIds, setStaffBuildingIds] = useState<number[]>([]);

  const { data: buildings = [] } = useBuildings();
  const { data: allRooms = [] } = useRooms();

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

  // Create time range for the day: 00:00 to next day 00:00 (to capture full 24 hours)
  const startAt = `${selectedDate}T00:00:00.000Z`;
  
  // End at beginning of NEXT day to capture all bookings through 23:59:59
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const endAt = `${nextDay.toISOString().split('T')[0]}T00:00:00.000Z`;

  const { data: availabilityData = [], isLoading, error } = useAvailability(
    startAt,
    endAt,
    undefined,
    true
  );

  // Get selected rooms with their building info
  const selectedRoomsWithBuilding: (Room & { buildingName?: string })[] = selectedRoomIds
    .map((roomId) => {
      const room = allRooms.find((r) => r.id === roomId);
      if (!room) return null;
      const building = buildings.find((b) => b.id === room.buildingId);
      return {
        ...room,
        buildingName: building?.name,
      };
    })
    .filter((r) => r !== null) as (Room & { buildingName?: string })[];

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleAddRoom = (roomId: number) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId]
    );
  };

  const handleRemoveRoom = (roomId: number) => {
    setSelectedRoomIds((prev) => prev.filter((id) => id !== roomId));
  };

  // Filter buildings and rooms based on user role
  const visibleBuildings = isStaff
    ? buildings.filter((b) => staffBuildingIds.includes(b.id))
    : buildings;

  // Rooms not yet selected and visible to the user
  const availableRooms = allRooms.filter(
    (r) => !selectedRoomIds.includes(r.id) && visibleBuildings.some((b) => b.id === r.buildingId)
  );

  // Build a map of room ID to availability data
  const roomAvailabilityMap = new Map<number, any>();
  availabilityData.forEach((building: AvailabilityBuilding) => {
    building.rooms.forEach((room) => {
      roomAvailabilityMap.set(room.id, room);
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Room Availability</h1>
        <p className="text-gray-600 mt-1">
          View room availability by selecting rooms to compare
        </p>
      </div>

      {/* Date Input */}
      <div className="card">
        <div className="card-header">
          <h3>Select Date</h3>
        </div>
        <div className="form-row">
          <div className="form-field" style={{ maxWidth: "200px" }}>
            <DateInput
              mode="date"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>
        </div>
      </div>

      {/* Rooms Selection */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3>Rooms</h3>
          <div className="flex gap-2">
            {availableRooms.length > 0 && (
              <div className="relative group">
                <button className="btn btn-primary btn-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Room
                </button>
                <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg hidden group-hover:block z-10 max-h-96 overflow-y-auto">
                  {availableRooms.map((room) => {
                    const building = visibleBuildings.find((b) => b.id === room.buildingId);
                    return (
                      <button
                        key={room.id}
                        onClick={() => handleAddRoom(room.id)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="font-medium text-sm">{building?.name} - {room.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedRoomIds.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No rooms selected. Click "Add Room" to get started.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-4">
            {selectedRoomsWithBuilding.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
              >
                <span className="text-sm font-medium text-blue-900">
                  {room.buildingName} - {room.name}
                </span>
                <button
                  onClick={() => handleRemoveRoom(room.id)}
                  className="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
                  title="Remove room"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Availability Grid */}
      {selectedRoomIds.length > 0 && (
        <RoomAvailabilityGrid
          selectedRooms={selectedRoomsWithBuilding}
          roomAvailabilityData={roomAvailabilityMap}
          isLoading={isLoading}
          error={error}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
