import { useState, useMemo } from "react";
import { useBuildings } from "../../hooks/useBuildings";
import { useRooms } from "../../hooks/useRooms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { BuildingActions } from "./BuildingActions";
import type { Building } from "../../lib/api/types";

interface BuildingsTableProps {
  onAddClick: () => void;
  onEditClick: (building: Building) => void;
}

export function BuildingsTable({
  onAddClick,
  onEditClick,
}: BuildingsTableProps) {
  const [search, setSearch] = useState("");
  const { data: buildings = [], isLoading, error, refetch } = useBuildings();
  const { data: allRooms = [] } = useRooms();

  const filteredBuildings = useMemo(() => {
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toString().includes(search)
    );
  }, [buildings, search]);

  const getRoomCount = (buildingId: number) => {
    const rooms = Array.isArray(allRooms) ? allRooms : [];
    return rooms.filter((r) => r.buildingId === buildingId).length;
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-red-500">Failed to load buildings</div>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Input
          placeholder="Search buildings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={onAddClick}>+ Add Building</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  Loading buildings...
                </TableCell>
              </TableRow>
            ) : filteredBuildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  {buildings.length === 0
                    ? "No buildings yet"
                    : "No buildings match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filteredBuildings.map((building) => (
                <TableRow key={building.id}>
                  <TableCell className="font-medium">{building.name}</TableCell>
                  <TableCell>{getRoomCount(building.id)}</TableCell>
                  <TableCell>
                    <BuildingActions
                      building={building}
                      onEdit={() => onEditClick(building)}
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
