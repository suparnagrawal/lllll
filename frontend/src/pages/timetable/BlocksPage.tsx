import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import type { SlotBlock, SlotDay, SlotTimeBand } from "../../lib/api/types";
import {
  getFullGrid,
  createBlock,
  deleteBlock,
} from "../../api/api";

export function BlocksPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [system, setSystem] = useState<any>(null);
  const [blocks, setBlocks] = useState<SlotBlock[]>([]);
  const [days, setDays] = useState<SlotDay[]>([]);
  const [timeBands, setTimeBands] = useState<SlotTimeBand[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(-1);
  const [selectedTimeBand, setSelectedTimeBand] = useState<number>(-1);
  const [blockName, setBlockName] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);
  const [bulkCount, setBulkCount] = useState(1);

  const systemId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    const loadData = async () => {
      if (!systemId) {
        setError("Invalid system ID");
        setLoading(false);
        return;
      }

      try {
        const gridData = await getFullGrid(systemId);
        setSystem(gridData.slotSystem);
        setDays(gridData.days);
        setTimeBands(gridData.timeBands);
        setBlocks(gridData.blocks);

        if (gridData.days.length > 0) {
          setSelectedDay(gridData.days[0].id);
        }
        if (gridData.timeBands.length > 0) {
          setSelectedTimeBand(gridData.timeBands[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [systemId]);

  const handleCreateBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!systemId || selectedDay === -1 || selectedTimeBand === -1) {
      setError("System, day, and time band are required");
      return;
    }

    if (!blockName.trim()) {
      setError("Block name is required");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await createBlock({
        slotSystemId: systemId,
        dayId: selectedDay,
        startBandId: selectedTimeBand,
        laneIndex: 0,
        rowSpan: 1,
        label: blockName.trim(),
      });

      setBlockName("");
      const updatedGrid = await getFullGrid(systemId);
      setBlocks(updatedGrid.blocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create block");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkCreateBlocks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!systemId || selectedDay === -1 || selectedTimeBand === -1) {
      setError("System, day, and time band are required");
      return;
    }

    if (!blockName.trim()) {
      setError("Block name is required");
      return;
    }

    if (bulkCount < 1) {
      setError("Bulk count must be at least 1");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const promises = Array.from({ length: bulkCount }, async (_, index) => {
        await createBlock({
          slotSystemId: systemId,
          dayId: selectedDay,
          startBandId: selectedTimeBand,
          laneIndex: index,
          rowSpan: 1,
          label: `${blockName.trim()}-${index + 1}`,
        });
      });

      await Promise.all(promises);
      setBlockName("");
      setBulkCount(1);
      const updatedGrid = await getFullGrid(systemId);
      setBlocks(updatedGrid.blocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to bulk create blocks");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBlock = async (blockId: number) => {
    const approved = window.confirm("Delete this block?");
    if (!approved) return;

    if (!systemId) {
      setError("Invalid system ID");
      return;
    }

    setDeletingBlockId(blockId);
    setActionLoading(true);
    setError(null);

    try {
      await deleteBlock(blockId);
      setBlocks(blocks.filter((b) => b.id !== blockId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete block");
    } finally {
      setDeletingBlockId(null);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const selectedDayObj = days.find((d) => d.id === selectedDay);
  const selectedBandObj = timeBands.find((b) => b.id === selectedTimeBand);
  const filteredBlocks = blocks.filter(
    (b) => b.dayId === selectedDay && b.startBandId === selectedTimeBand
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/timetable/systems")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Blocks</h1>
          <p className="text-gray-600 mt-1">
            {system?.name} • Create and manage timetable blocks
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Create Single Block</h2>
            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day
                </label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][
                        day.dayOfWeek === "MON" ? 0
                          : day.dayOfWeek === "TUE" ? 1
                          : day.dayOfWeek === "WED" ? 2
                          : day.dayOfWeek === "THU" ? 3
                          : day.dayOfWeek === "FRI" ? 4
                          : day.dayOfWeek === "SAT" ? 5
                          : 6
                      ]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Band
                </label>
                <select
                  value={selectedTimeBand}
                  onChange={(e) =>
                    setSelectedTimeBand(parseInt(e.target.value, 10))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {timeBands.map((band) => (
                    <option key={band.id} value={band.id}>
                      {band.startTime} – {band.endTime}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block Name
                </label>
                <input
                  type="text"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  placeholder="e.g., Lab-A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading || days.length === 0 || timeBands.length === 0}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Block
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Bulk Create Blocks</h2>
            <form onSubmit={handleBulkCreateBlocks} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Blocks
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Name
                </label>
                <input
                  type="text"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  placeholder="e.g., Lab"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-sm text-gray-500">
                Will create blocks named: {blockName}-1, {blockName}-2, etc.
              </p>

              <button
                type="submit"
                disabled={actionLoading || days.length === 0 || timeBands.length === 0}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Bulk Create
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Blocks
            {selectedDayObj && selectedBandObj && (
              <span className="text-gray-600 ml-2 text-sm">
                ({["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][
                  selectedDayObj.dayOfWeek === "MON" ? 0
                    : selectedDayObj.dayOfWeek === "TUE" ? 1
                    : selectedDayObj.dayOfWeek === "WED" ? 2
                    : selectedDayObj.dayOfWeek === "THU" ? 3
                    : selectedDayObj.dayOfWeek === "FRI" ? 4
                    : selectedDayObj.dayOfWeek === "SAT" ? 5
                    : 6
                ]}, {selectedBandObj.startTime} – {selectedBandObj.endTime})
              </span>
            )}
          </h2>
          {filteredBlocks.length === 0 ? (
            <p className="text-gray-500">No blocks created for this selection</p>
          ) : (
            <div className="space-y-2">
              {filteredBlocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium">{block.label}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    disabled={actionLoading || deletingBlockId === block.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => navigate("/timetable/systems")}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => navigate("/timetable/systems")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
