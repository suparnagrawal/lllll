import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Edit2, Trash2, X, Check } from "lucide-react";
import type { SlotTimeBand } from "../../lib/api/types";
import {
  getFullGrid,
  createTimeBand,
  updateTimeBand,
  deleteTimeBand,
} from "../../api/api";

export function TimeBandsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [system, setSystem] = useState<any>(null);
  const [timeBands, setTimeBands] = useState<SlotTimeBand[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
        setTimeBands(gridData.timeBands);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [systemId]);

  const validateTimes = (start: string, end: string): string | null => {
    if (!start || !end) {
      return "Both start and end times are required";
    }

    if (start >= end) {
      return "End time must be after start time";
    }

    const isOverlapping = timeBands.some((band) => {
      if (editingId && band.id === editingId) return false;
      return (
        (start < band.endTime && end > band.startTime)
      );
    });

    if (isOverlapping) {
      return "Time band overlaps with existing band";
    }

    return null;
  };

  const handleAddTimeBand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!systemId) {
      setError("Invalid system ID");
      return;
    }

    const validationError = validateTimes(startTime, endTime);
    if (validationError) {
      setError(validationError);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const newBand = await createTimeBand({
        slotSystemId: systemId,
        startTime,
        endTime,
      });
      setTimeBands([...timeBands, newBand]);
      setStartTime("");
      setEndTime("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add time band");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditTimeBand = (band: SlotTimeBand) => {
    setEditingId(band.id);
    setEditStart(band.startTime);
    setEditEnd(band.endTime);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const validationError = validateTimes(editStart, editEnd);
    if (validationError) {
      setError(validationError);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const updated = await updateTimeBand(editingId, {
        startTime: editStart,
        endTime: editEnd,
      });
      setTimeBands(
        timeBands.map((b) => (b.id === editingId ? updated : b))
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update time band");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTimeBand = async (bandId: number) => {
    const approved = window.confirm("Delete this time band?");
    if (!approved) return;

    setDeletingId(bandId);
    setActionLoading(true);
    setError(null);

    try {
      await deleteTimeBand(bandId);
      setTimeBands(timeBands.filter((b) => b.id !== bandId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete time band");
    } finally {
      setDeletingId(null);
      setActionLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const sortedBands = [...timeBands].sort(
    (a, b) => a.orderIndex - b.orderIndex
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
          <h1 className="text-3xl font-bold tracking-tight">Configure Time Bands</h1>
          <p className="text-gray-600 mt-1">
            {system?.name} • Define available time slots
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Add Time Band</h2>
          <form onSubmit={handleAddTimeBand} className="flex gap-3">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={actionLoading || !startTime || !endTime}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Time Bands</h2>
          {sortedBands.length === 0 ? (
            <p className="text-gray-500">No time bands configured yet</p>
          ) : (
            <div className="space-y-2">
              {sortedBands.map((band) => (
                <div key={band.id} className="border border-gray-200 rounded-lg p-4">
                  {editingId === band.id ? (
                    <div className="flex gap-3 items-center">
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={handleSaveEdit}
                          disabled={actionLoading}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={actionLoading}
                          className="p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="font-medium">
                          {band.startTime} – {band.endTime}
                        </div>
                        <div className="text-sm text-gray-500">
                          ({calculateDuration(band.startTime, band.endTime)} min)
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTimeBand(band)}
                          disabled={actionLoading}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTimeBand(band.id)}
                          disabled={actionLoading || deletingId === band.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
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

function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  return (endHour - startHour) * 60 + (endMin - startMin);
}
