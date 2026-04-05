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
import { Check } from "lucide-react";
import type { Building, UserRole } from "../../lib/api/types";

interface BuildingsTableProps {
  onAddClick: () => void;
  onEditClick: (building: Building) => void;
  userRole?: UserRole;
  staffBuildingIds?: number[];
}

export function BuildingsTable({
  onAddClick,
  onEditClick,
  userRole,
  staffBuildingIds = [],
}: BuildingsTableProps) {
  const [search, setSearch] = useState("");
  const { data: buildings = [], isLoading, error, refetch } = useBuildings();
  const { data: allRooms = [] } = useRooms();

  const isAdmin = userRole === "ADMIN";
  const isStaff = userRole === "STAFF";
  const canAddBuilding = isAdmin;

  const filteredBuildings = useMemo(() => {
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [buildings, search]);

  const getRoomCount = (buildingId: number) => {
    const rooms = Array.isArray(allRooms) ? allRooms : [];
    return rooms.filter((r) => r.buildingId === buildingId).length;
  };

  // Determine if user can edit a specific building
  const canEditBuilding = (buildingId: number) => {
    if (isAdmin) return true;
    if (isStaff && staffBuildingIds.includes(buildingId)) return true;
    return false;
  };

  // Only admins can delete buildings
  const canDeleteBuilding = isAdmin;

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
        {canAddBuilding && <Button onClick={onAddClick}>+ Add Building</Button>}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rooms</TableHead>
              {isStaff && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isStaff ? 4 : 3} className="text-center py-8">
                  Loading buildings...
                </TableCell>
              </TableRow>
            ) : filteredBuildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isStaff ? 4 : 3} className="text-center py-8">
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
                  {isStaff && (
                    <TableCell>
                      {staffBuildingIds.includes(building.id) ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded w-fit">
                          <Check className="h-3 w-3" />
                          Assigned
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Not assigned</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <BuildingActions
                      building={building}
                      onEdit={() => onEditClick(building)}
                      canEdit={canEditBuilding(building.id)}
                      canDelete={canDeleteBuilding}
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
