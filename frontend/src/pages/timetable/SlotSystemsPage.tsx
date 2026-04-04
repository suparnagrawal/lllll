import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SlotSystemsTable } from "../components/SlotSystemsTable";
import { SlotSystemFormDialog } from "../components/SlotSystemFormDialog";
import type { SlotSystem } from "../../lib/api/types";

export function SlotSystemsPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddSlotSystem = () => {
    setDialogOpen(true);
  };

  const handleConfigureSlotSystem = (system: SlotSystem) => {
    // Navigate to slot system configuration page with options for Days, Time Bands, Blocks
    navigate(`/timetable/${system.id}/configure`, {
      state: { slotSystem: system },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Slot Systems</h1>
        <p className="text-gray-600 mt-2">
          Manage your timetable slot systems and configurations
        </p>
      </div>

      <SlotSystemsTable
        onAddClick={handleAddSlotSystem}
        onConfigureClick={handleConfigureSlotSystem}
      />

      <SlotSystemFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
