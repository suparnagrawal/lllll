import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { BuildingsTable } from "./components/BuildingsTable";
import { RoomsTable } from "./components/RoomsTable";
import { BuildingFormDialog } from "./components/BuildingFormDialog";
import { RoomFormDialog } from "./components/RoomFormDialog";
import type { Building, Room } from "../lib/api/types";

export function RoomsPage() {
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const handleAddBuilding = () => {
    setEditingBuilding(null);
    setBuildingDialogOpen(true);
  };

  const handleEditBuilding = (building: Building) => {
    setEditingBuilding(building);
    setBuildingDialogOpen(true);
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setRoomDialogOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Buildings & Rooms</h1>
        <p className="text-gray-600 mt-2">
          Manage your buildings and rooms in one place
        </p>
      </div>

      <Tabs defaultValue="buildings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buildings">Buildings</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="buildings" className="space-y-4">
          <BuildingsTable
            onAddClick={handleAddBuilding}
            onEditClick={handleEditBuilding}
          />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomsTable onAddClick={handleAddRoom} onEditClick={handleEditRoom} />
        </TabsContent>
      </Tabs>

      <BuildingFormDialog
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        building={editingBuilding}
      />

      <RoomFormDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        room={editingRoom}
      />
    </div>
  );
}
