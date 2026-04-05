import { useState } from "react";
import { Trash2, Edit2, MoreVertical } from "lucide-react";
import type { Building, UserRole } from "../../lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useDeleteBuilding } from "../../hooks/useBuildings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

interface BuildingCardProps {
  building: Building;
  roomCount: number;
  onClick: () => void;
  onEdit: () => void;
  userRole?: UserRole;
}

export function BuildingCard({
  building,
  roomCount,
  onClick,
  onEdit,
  userRole,
}: BuildingCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteBuilding = useDeleteBuilding();
  const isAdmin = userRole === "ADMIN";

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-lg hover:border-blue-500 transition-all duration-200"
    >
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <CardTitle className="text-lg flex-1">{building.name}</CardTitle>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600">
          <p className="font-semibold text-gray-900">{roomCount}</p>
          <p className="text-gray-600">
            {roomCount === 1 ? "room" : "rooms"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
