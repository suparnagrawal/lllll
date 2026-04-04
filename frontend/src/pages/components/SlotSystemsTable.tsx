import { useState } from "react";
import { useSlotSystems, useDeleteSlotSystem } from "../../hooks/useSlotSystems";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import type { SlotSystem } from "../../lib/api/types";

interface SlotSystemsTableProps {
  onAddClick: () => void;
  onConfigureClick: (system: SlotSystem) => void;
}

export function SlotSystemsTable({
  onAddClick,
  onConfigureClick,
}: SlotSystemsTableProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data: slotSystems = [], isLoading, error, refetch } = useSlotSystems();
  const deleteMutation = useDeleteSlotSystem();

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingId(null);
    } catch (err) {
      console.error("Failed to delete slot system:", err);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-red-500">Failed to load slot systems</div>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Slot Systems</h2>
          <Button onClick={onAddClick}>+ New Slot System</Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading slot systems...
                  </TableCell>
                </TableRow>
              ) : !slotSystems || slotSystems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No slot systems yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                slotSystems.map((system: SlotSystem) => (
                  <TableRow key={system.id}>
                    <TableCell className="font-medium">{system.name}</TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(system.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onConfigureClick(system)}
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingId(system.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => {
        if (!open) setDeletingId(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slot System</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this slot system? This action cannot be undone.
              All associated data will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId !== null) {
                  handleDelete(deletingId);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
