import { useState } from "react";
import { Plus } from "lucide-react";
import { useAvailability } from "../hooks/useAvailability";
import { useBuildings } from "../hooks/useBuildings";
import type { AvailabilityBuilding } from "../lib/api";
import { RoomAvailabilityGrid } from "../components/features/bookings/RoomAvailabilityGrid";
import type {
  BookingRequestPrefill,
  AvailabilityPrefill,
} from "./bookingAvailabilityBridge";
import { DateInput } from "../components/DateInput";

type AvailabilityPageProps = {
  canRequestBooking?: boolean;
  prefill?: AvailabilityPrefill | null;
  onPrefillApplied?: () => void;
  onRequestBooking?: (prefill: BookingRequestPrefill) => void;
};

export function AvailabilityPage({
  canRequestBooking: _canRequestBooking,
  prefill: _prefill,
  onPrefillApplied: _onPrefillApplied,
  onRequestBooking: _onRequestBooking,
}: AvailabilityPageProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([]);

  const { data: buildings = [] } = useBuildings();

  // Create time range for the day: 00:00 to 23:59
  const startAt = `${selectedDate}T00:00`;
  const endAt = `${selectedDate}T23:59`;

  const { data: allResults = [], isLoading, error } = useAvailability(
    startAt,
    endAt,
    undefined,
    true
  );

  // Filter to selected buildings only
  const filteredResults: AvailabilityBuilding[] = allResults.filter((b) =>
    selectedBuildingIds.includes(b.buildingId)
  );

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleAddBuilding = (buildingId: number) => {
    setSelectedBuildingIds((prev) =>
      prev.includes(buildingId) ? prev : [...prev, buildingId]
    );
  };

  const handleRemoveBuilding = (buildingId: number) => {
    setSelectedBuildingIds((prev) => prev.filter((id) => id !== buildingId));
  };

  const unselectedBuildings = buildings.filter(
    (b) => !selectedBuildingIds.includes(b.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Room Availability</h1>
        <p className="text-gray-600 mt-1">
          View room availability and booking details with role-based access control
        </p>
      </div>

      {/* Date Input */}
      <div className="card">
        <div className="card-header">
          <h3>Select Date</h3>
        </div>
        <div className="form-row">
          <div className="form-field" style={{ maxWidth: "200px" }}>
            <DateInput
              mode="date"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>
        </div>
      </div>

      {/* Buildings Selection */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3>Buildings</h3>
          <div className="flex gap-2">
            {unselectedBuildings.length > 0 && (
              <div className="relative group">
                <button className="btn btn-primary btn-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Add Building
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg hidden group-hover:block z-10">
                  {unselectedBuildings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleAddBuilding(b.id)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedBuildingIds.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No buildings selected. Click "Add Building" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {selectedBuildingIds.map((buildingId) => {
              const building = buildings.find((b) => b.id === buildingId);
              return (
                <div
                  key={buildingId}
                  className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <span className="text-sm font-medium text-blue-900">
                    {building?.name}
                  </span>
                  <button
                    onClick={() => handleRemoveBuilding(buildingId)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
                    title="Remove building"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Availability Grid */}
      {selectedBuildingIds.length > 0 && (
        <RoomAvailabilityGrid
          data={filteredResults}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
}
