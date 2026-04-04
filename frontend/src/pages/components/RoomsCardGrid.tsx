import { useMemo } from "react";
import type { Room } from "../../lib/api/types";
import { RoomCard } from "./RoomCard";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";

interface RoomsCardGridProps {
  rooms: Room[];
  buildingId: number;
  onEditClick: (room: Room) => void;
  onAddClick: () => void;
  isLoading?: boolean;
}

export function RoomsCardGrid({
  rooms,
  buildingId,
  onEditClick,
  onAddClick,
  isLoading = false,
}: RoomsCardGridProps) {
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => room.buildingId === buildingId);
  }, [rooms, buildingId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Rooms</h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredRooms.length} {filteredRooms.length === 1 ? "room" : "rooms"} total
          </p>
        </div>
        <Button onClick={onAddClick} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading rooms...</div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="font-medium">No rooms yet</p>
          <p className="text-sm mt-1">Click "Add Room" to create one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEditClick={() => onEditClick(room)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
