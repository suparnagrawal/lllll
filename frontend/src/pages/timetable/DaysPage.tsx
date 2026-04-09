import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import type { SlotDay, DayOfWeek } from "../../lib/api/types";
import {
  getFullGrid,
  createDay,
  deleteDay,
} from "../../lib/api";

const DAY_OF_WEEK_OPTIONS: DayOfWeek[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export function DaysPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [system, setSystem] = useState<any>(null);
  const [days, setDays] = useState<SlotDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("MON");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingDayId, setDeletingDayId] = useState<number | null>(null);

  const systemId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    const loadData = async () => {
      if (!systemId) {
        setError("Invalid slot system selection");
        setLoading(false);
        return;
      }

      try {
        const gridData = await getFullGrid(systemId);
        setSystem(gridData.slotSystem);
        setDays(gridData.days);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [systemId]);

  const handleAddDay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!systemId) {
      setError("Invalid slot system selection");
      return;
    }

    const dayExists = days.some((d) => d.dayOfWeek === selectedDay);
    if (dayExists) {
      setError(`${DAY_LABELS[selectedDay]} already exists`);
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const newDay = await createDay({
        slotSystemId: systemId,
        dayOfWeek: selectedDay,
      });
      setDays([...days, newDay]);
      setSelectedDay("MON");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add day");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDay = async (day: SlotDay) => {
    const dayLabel = DAY_LABELS[day.dayOfWeek];
    const approved = window.confirm(`Delete ${dayLabel}?`);

    if (!approved) {
      return;
    }

    setDeletingDayId(day.id);
    setActionLoading(true);
    setError(null);

    try {
      await deleteDay(day.id);
      setDays(days.filter((d) => d.id !== day.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete day");
    } finally {
      setDeletingDayId(null);
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

  const sortedDays = [...days].sort((a, b) => a.orderIndex - b.orderIndex);
  const availableDays = DAY_OF_WEEK_OPTIONS.filter(
    (day) => !days.some((d) => d.dayOfWeek === day)
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
          <h1 className="text-3xl font-bold tracking-tight">Configure Days</h1>
          <p className="text-gray-600 mt-1">
            {system?.name} • Select which days are available for this slot
            system
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
          <h2 className="text-lg font-semibold mb-4">Add Day</h2>
          <form onSubmit={handleAddDay} className="flex gap-3">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableDays.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={actionLoading || availableDays.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
          {availableDays.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              All days have been added
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Configured Days</h2>
          {sortedDays.length === 0 ? (
            <p className="text-gray-500">No days configured yet</p>
          ) : (
            <div className="space-y-2">
              {sortedDays.map((day) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium">{DAY_LABELS[day.dayOfWeek]}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteDay(day)}
                    disabled={actionLoading || deletingDayId === day.id}
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
