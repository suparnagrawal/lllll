import { useState } from "react";
import { BuildingsCardGrid } from "./components/BuildingsCardGrid";
import { BuildingRoomsModal } from "./components/BuildingRoomsModal";
import { BuildingFormDialog } from "./components/BuildingFormDialog";
import { RoomFormDialog } from "./components/RoomFormDialog";
import { useRooms } from "../hooks/useRooms";
import type { Building, Room } from "../lib/api/types";

export function RoomsPage() {
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const { data: allRooms = [], isLoading: roomsLoading } = useRooms();

  const handleAddBuilding = () => {
    setEditingBuilding(null);
    setBuildingDialogOpen(true);
  };

  const handleEditBuilding = (building: Building) => {
    setEditingBuilding(building);
    setBuildingDialogOpen(true);
  };

  const handleBuildingClick = (building: Building) => {
    setSelectedBuilding(building);
    setRoomsModalOpen(true);
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setRoomDialogOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomDialogOpen(true);
  };

  const handleRoomDialogClose = () => {
    setRoomDialogOpen(false);
    setEditingRoom(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buildings & Rooms</h1>
        <p className="text-gray-600 mt-2">
          Click on a building to manage its rooms
        </p>
      </div>

      <BuildingsCardGrid
        onBuildingClick={handleBuildingClick}
        onBuildingEdit={handleEditBuilding}
        onAddClick={handleAddBuilding}
      />

      <BuildingRoomsModal
        open={roomsModalOpen}
        onOpenChange={setRoomsModalOpen}
        building={selectedBuilding}
        rooms={Array.isArray(allRooms) ? allRooms : []}
        onRoomEdit={handleEditRoom}
        onAddRoom={handleAddRoom}
        isLoading={roomsLoading}
      />

      <BuildingFormDialog
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        building={editingBuilding}
      />

      <RoomFormDialog
        open={roomDialogOpen}
        onOpenChange={handleRoomDialogClose}
        room={editingRoom}
        defaultBuildingId={selectedBuilding?.id}
      />
    </div>
  );
}
