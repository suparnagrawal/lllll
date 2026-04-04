import { useMemo, useState } from "react";
import { useBuildings } from "../../hooks/useBuildings";
import { useRooms } from "../../hooks/useRooms";
import { BuildingCard } from "./BuildingCard";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { Building } from "../../lib/api/types";

interface BuildingsCardGridProps {
  onBuildingClick: (building: Building) => void;
  onBuildingEdit: (building: Building) => void;
  onAddClick: () => void;
}

export function BuildingsCardGrid({
  onBuildingClick,
  onBuildingEdit,
  onAddClick,
}: BuildingsCardGridProps) {
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
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <Input
          placeholder="Search buildings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={onAddClick}>+ Add Building</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading buildings...</div>
      ) : filteredBuildings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {buildings.length === 0
            ? "No buildings yet. Create one to get started!"
            : "No buildings match your search"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBuildings.map((building) => (
            <BuildingCard
              key={building.id}
              building={building}
              roomCount={getRoomCount(building.id)}
              onClick={() => onBuildingClick(building)}
              onEdit={() => onBuildingEdit(building)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
