import { useState, useMemo } from "react";
import { useRooms } from "../../hooks/useRooms";
import { useBuildings } from "../../hooks/useBuildings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { RoomActions } from "./RoomActions";
import type { Room, Building } from "../../lib/api/types";

interface RoomsTableProps {
  onAddClick: () => void;
  onEditClick: (room: Room) => void;
}

export function RoomsTable({ onAddClick, onEditClick }: RoomsTableProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const { data: buildings = [] } = useBuildings();
  const { data: rooms = [], isLoading, error, refetch } = useRooms();
  const isArray = Array.isArray(rooms);
  const allRooms = isArray ? rooms : [];

  const filteredRooms = useMemo(() => {
    if (!selectedBuildingId) return allRooms;
    return allRooms.filter(
      (room: Room) => room.buildingId === Number(selectedBuildingId)
    );
  }, [allRooms, selectedBuildingId]);

  const getBuildingName = (buildingId: number) => {
    return (
      buildings.find((b: Building) => b.id === buildingId)?.name ||
      "Unknown Building"
    );
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-red-500">Failed to load rooms</div>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by building" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Buildings</SelectItem>
            {buildings.map((building: Building) => (
              <SelectItem key={building.id} value={building.id.toString()}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onAddClick}>+ Add Room</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Building</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  Loading rooms...
                </TableCell>
              </TableRow>
            ) : filteredRooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  {allRooms.length === 0 ? "No rooms yet" : "No rooms in selected building"}
                </TableCell>
              </TableRow>
            ) : (
              filteredRooms.map((room: Room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>{getBuildingName(room.buildingId)}</TableCell>
                  <TableCell>
                    <RoomActions
                      room={room}
                      onEdit={() => onEditClick(room)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
