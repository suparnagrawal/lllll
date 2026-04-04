import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import type { Room } from "../../lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useDeleteRoom } from "../../hooks/useRooms";

interface RoomCardProps {
  room: Room;
  onEditClick: () => void;
}

export function RoomCard({ room, onEditClick }: RoomCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteRoom = useDeleteRoom();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete room "${room.name}"?`)) {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteRoom.mutateAsync(room.id);
    } catch {
      alert("Failed to delete room");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <CardTitle className="text-base">{room.name}</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditClick}
            className="hover:bg-blue-50 h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="hover:bg-red-50 h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500">Room ID: {room.id}</p>
      </CardContent>
    </Card>
  );
}
