import { useState, useEffect } from "react";
import { BuildingsCardGrid } from "./components/BuildingsCardGrid";
import { BuildingRoomsModal } from "./components/BuildingRoomsModal";
import { BuildingFormDialog } from "./components/BuildingFormDialog";
import { RoomFormDialog } from "./components/RoomFormDialog";
import { useRooms } from "../hooks/useRooms";
import { useBuildings } from "../hooks/useBuildings";
import { useAuth } from "../auth/AuthContext";
import { getUserBuildingAssignments } from "../lib/api";
import type { Building, Room } from "../lib/api/types";

export function RoomsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const isAuthorized = isAdmin || isStaff;

  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [staffBuildingIds, setStaffBuildingIds] = useState<number[]>([]);

  const { data: allBuildings = [] } = useBuildings();
  const { data: allRooms = [], isLoading: roomsLoading } = useRooms();

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

  // Filter buildings based on user role
  const visibleBuildings = isStaff
    ? allBuildings.filter((b) => staffBuildingIds.includes(b.id))
    : allBuildings;

  if (!isAuthorized) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Access Restricted</h2>
          <p className="text-yellow-800 mt-2">
            This page is only available to Admin and Staff users. Please contact your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

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
        userRole={user?.role}
        buildings={visibleBuildings}
      />

      <BuildingRoomsModal
        open={roomsModalOpen}
        onOpenChange={setRoomsModalOpen}
        building={selectedBuilding}
        rooms={Array.isArray(allRooms) ? allRooms : []}
        onRoomEdit={handleEditRoom}
        onAddRoom={handleAddRoom}
        isLoading={roomsLoading}
        userRole={user?.role}
      />

      <BuildingFormDialog
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        building={editingBuilding}
        canView={isAdmin}
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
