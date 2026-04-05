import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { useDeleteRoom } from "../../hooks/useRooms";
import type { Room, UserRole } from "../../lib/api/types";

interface RoomActionsProps {
  room: Room;
  onEdit: () => void;
  userRole?: UserRole;
}

export function RoomActions({ room, onEdit, userRole }: RoomActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteRoom = useDeleteRoom();
  const isAdmin = userRole === "ADMIN";

  if (!isAdmin) {
    return null;
  }

  const handleDelete = async () => {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          •••
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-600"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
