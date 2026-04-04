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
import { useCreateSlotSystem } from "../../hooks/useSlotSystems";

const slotSystemSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(500).optional().default(""),
});

type SlotSystemFormData = z.infer<typeof slotSystemSchema>;

interface SlotSystemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SlotSystemFormDialog({
  open,
  onOpenChange,
}: SlotSystemFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateSlotSystem();
  const isLoading = createMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SlotSystemFormData>({
    resolver: zodResolver(slotSystemSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (data: SlotSystemFormData) => {
    try {
      setError(null);
      await createMutation.mutateAsync(data.name);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create slot system");
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
          <DialogTitle>New Slot System</DialogTitle>
          <DialogDescription>
            Create a new slot system to organize your timetable
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Spring 2024"
              {...register("name")}
              disabled={isLoading}
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional description"
              {...register("description")}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

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
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
