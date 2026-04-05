import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import type { Building, Room, UserRole } from "../../lib/api/types";
import { RoomsCardGrid } from "./RoomsCardGrid";

interface BuildingRoomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building: Building | null;
  rooms: Room[];
  onRoomEdit: (room: Room) => void;
  onAddRoom: (buildingId: number) => void;
  isLoading?: boolean;
  userRole?: UserRole;
}

export function BuildingRoomsModal({
  open,
  onOpenChange,
  building,
  rooms,
  onRoomEdit,
  onAddRoom,
  isLoading = false,
  userRole,
}: BuildingRoomsModalProps) {
  if (!building) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4 sm:py-5">
          <DialogTitle className="text-2xl">{building.name}</DialogTitle>
          <DialogDescription>
            Manage rooms in this building
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <RoomsCardGrid
            rooms={rooms}
            buildingId={building.id}
            onEditClick={onRoomEdit}
            onAddClick={() => onAddRoom(building.id)}
            isLoading={isLoading}
            userRole={userRole}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
