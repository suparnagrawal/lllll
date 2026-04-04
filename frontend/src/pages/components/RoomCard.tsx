import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { Room } from "../../lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
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
    <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105">
      <CardHeader className="pb-4 flex flex-row items-start justify-between space-y-0">
        <div className="flex-1">
          <CardTitle className="text-lg font-semibold break-words">{room.name}</CardTitle>
        </div>
        <div className="flex-shrink-0 ml-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Room actions"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditClick}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
    </Card>
  );
}
