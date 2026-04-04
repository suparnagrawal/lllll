import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useCreateRoom, useUpdateRoom } from "../../hooks/useRooms";
import { useBuildings } from "../../hooks/useBuildings";
import type { Building, Room } from "../../lib/api/types";

const roomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100),
  buildingId: z.coerce.number().int("Building is required").positive(),
});

type RoomFormData = z.infer<typeof roomSchema>;

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room | null;
  defaultBuildingId?: number;
}

export function RoomFormDialog({
  open,
  onOpenChange,
  room,
  defaultBuildingId,
}: RoomFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const { data: buildings = [] } = useBuildings();
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room?.name || "",
      buildingId: room?.buildingId || defaultBuildingId || undefined,
    },
  });

  const buildingId = watch("buildingId");

  const onSubmit = async (data: RoomFormData) => {
    try {
      setError(null);
      if (room?.id) {
        await updateMutation.mutateAsync({ id: room.id, name: data.name });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          buildingId: data.buildingId,
        });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
          <DialogDescription>
            {room
              ? "Update the room details"
              : "Enter the room name and select a building"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name</Label>
            <Input
              id="name"
              placeholder="e.g., Conference Room A"
              {...register("name")}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {!room && (
            <div className="space-y-2">
              <Label htmlFor="building">Building</Label>
              <Select
                value={buildingId?.toString() || ""}
                onValueChange={(value) => setValue("buildingId", Number(value))}
              >
                <SelectTrigger disabled={isLoading}>
                  <SelectValue placeholder="Select a building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((building: Building) => (
                    <SelectItem key={building.id} value={building.id.toString()}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.buildingId && (
                <p className="text-sm text-red-500">
                  {errors.buildingId.message}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : room ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
