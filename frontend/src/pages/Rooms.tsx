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
import { useSystemQoLPreferences } from "../hooks/useSystemQoLPreferences";

export function RoomsPage() {
  const { user } = useAuth();
  const { preferences } = useSystemQoLPreferences();
  const sectionAutoLoad = preferences.autoLoadSections.rooms;
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";

  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [staffBuildingIds, setStaffBuildingIds] = useState<number[]>([]);
  const [hasRequestedDataLoad, setHasRequestedDataLoad] = useState(
    () => !preferences.manualDataLoading || sectionAutoLoad,
  );

  const shouldLoadData =
    !preferences.manualDataLoading ||
    sectionAutoLoad ||
    hasRequestedDataLoad;

  useEffect(() => {
    if (!preferences.manualDataLoading || sectionAutoLoad) {
      setHasRequestedDataLoad(true);
    }
  }, [preferences.manualDataLoading, sectionAutoLoad]);

  const { data: allBuildings = [] } = useBuildings(shouldLoadData);
  const { data: allRooms = [], isLoading: roomsLoading } = useRooms(undefined, shouldLoadData);

  // Load staff's assigned buildings for RBAC on edit/delete
  useEffect(() => {
    if (!shouldLoadData) {
      setStaffBuildingIds([]);
      return;
    }

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
  }, [isStaff, shouldLoadData, user]);

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

  // All users can view all buildings and rooms
  // Edit/delete permissions are handled at the component level
  const visibleBuildings = allBuildings;

  const showDataLoadGate =
    preferences.manualDataLoading &&
    !sectionAutoLoad &&
    !hasRequestedDataLoad;

  if (showDataLoadGate) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buildings & Rooms</h1>
          <p className="text-gray-600 mt-2">
            Load building and room data when you need it.
          </p>
        </div>

        <div className="alert">
          Manual data loading is enabled for better performance.
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "var(--space-2)" }}
            onClick={() => setHasRequestedDataLoad(true)}
          >
            Load Buildings & Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buildings & Rooms</h1>
        <p className="text-gray-600 mt-2">
          {isAdmin || isStaff
            ? "Click on a building to manage its rooms"
            : "Browse available buildings and rooms"}
        </p>
      </div>

      <div className="alert">
        Data mode: {preferences.manualDataLoading ? "Manual" : "Automatic"}. Admins can update this globally from System Loading settings.
      </div>

      <BuildingsCardGrid
        onBuildingClick={handleBuildingClick}
        onBuildingEdit={handleEditBuilding}
        onAddClick={handleAddBuilding}
        userRole={user?.role}
        buildings={visibleBuildings}
        rooms={Array.isArray(allRooms) ? allRooms : []}
        dataEnabled={shouldLoadData}
        staffBuildingIds={staffBuildingIds}
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
        canEdit={
          isAdmin ||
          (isStaff && selectedBuilding !== null && staffBuildingIds.includes(selectedBuilding.id))
        }
      />

      <BuildingFormDialog
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        building={editingBuilding}
        canView={
          isAdmin ||
          (isStaff && editingBuilding !== null && staffBuildingIds.includes(editingBuilding.id))
        }
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
