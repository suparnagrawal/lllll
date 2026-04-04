import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { useDeleteBuilding } from "../../hooks/useBuildings";
import type { Building } from "../../lib/api/types";

interface BuildingActionsProps {
  building: Building;
  onEdit: () => void;
}

export function BuildingActions({ building, onEdit }: BuildingActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteBuilding = useDeleteBuilding();

  const handleDelete = async () => {
    if (!window.confirm(`Delete building "${building.name}"?`)) {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteBuilding.mutateAsync(building.id);
    } catch {
      alert("Failed to delete building");
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
