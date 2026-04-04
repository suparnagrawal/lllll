import { useState } from "react";
import { useAvailability, useBuildings, useRooms } from "../hooks/useAvailability";
import type { AvailabilityBuilding } from "../lib/api";
import { DateInput } from "../components/DateInput";
import type {
  BookingRequestPrefill,
  AvailabilityPrefill,
} from "./bookingAvailabilityBridge";

type ViewMode = "calendar" | "list";

type AvailabilityPageProps = {
  canRequestBooking?: boolean;
  prefill?: AvailabilityPrefill | null;
  onPrefillApplied?: () => void;
  onRequestBooking?: (prefill: BookingRequestPrefill) => void;
};

export function AvailabilityPage({
  canRequestBooking = false,
  onRequestBooking,
}: AvailabilityPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [buildingId, setBuildingId] = useState<"" | number>("");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  const { data: buildings = [], isLoading: buildingsLoading } = useBuildings();
  const buildingIdValid: boolean = buildingId !== "";
  const { data: rooms = [] } = useRooms(
    buildingIdValid ? (buildingId as number) : undefined,
    buildingIdValid
  );

  const hasValidDates: boolean = !!(startDate && endDate && new Date(startDate) <= new Date(endDate));
  const { data: results, isLoading, error } = useAvailability(
    startDate ? `${startDate}T${startTime}` : "",
    endDate ? `${endDate}T${endTime}` : "",
    buildingId !== "" ? buildingId : undefined,
    hasValidDates
  );

  const filteredResults = showOnlyAvailable
    ? results?.map((b) => ({
        ...b,
        rooms: b.rooms.filter((r) => r.isAvailable),
      }))
    : results;

  const handleBookNow = (
    roomId: number,
    buildingId: number
  ) => {
    if (!canRequestBooking || !onRequestBooking) return;
    onRequestBooking({
      roomId,
      startAt: `${startDate}T${startTime}`,
      endAt: `${endDate}T${endTime}`,
      buildingId,
    });
  };

  return (
    <div className="availability-page">
      <form onSubmit={(e) => e.preventDefault()} className="availability-search-form">
        <div className="search-grid">
          <div className="form-field">
            <label htmlFor="startDate">Start Date</label>
            <DateInput
              id="startDate"
              mode="date"
              value={startDate}
              onChange={setStartDate}
            />
          </div>

          <div className="form-field">
            <label htmlFor="endDate">End Date</label>
            <DateInput
              id="endDate"
              mode="date"
              value={endDate}
              onChange={setEndDate}
            />
          </div>

          <div className="form-field">
            <label htmlFor="startTime">Start Time</label>
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="endTime">End Time</label>
            <input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="building">Building</label>
            <select
              id="building"
              className="input"
              value={buildingId ?? ""}
              onChange={(e) =>
                setBuildingId(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={buildingsLoading}
            >
              <option value="">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="room">Room</label>
            <select
              id="room"
              className="input"
              disabled={!buildingId}
            >
              <option>All Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="search-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!hasValidDates || isLoading}
          >
            {isLoading ? "Searching..." : "Search"}
          </button>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
            />
            <span>Only available</span>
          </label>

          {hasValidDates && (
            <div className="view-toggle">
              <button
                type="button"
                className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
              >
                Calendar
              </button>
            </div>
          )}
        </div>
      </form>

      {error && <div className="alert alert-error">{error?.toString()}</div>}
      {isLoading && <div className="loading">Loading...</div>}

      {hasValidDates && !isLoading && filteredResults && (
        <div className="availability-results">
          {filteredResults.length === 0 ? (
            <p className="empty">
              {showOnlyAvailable ? "No available rooms" : "No rooms found"}
            </p>
          ) : (
            <>
              <h3>Results ({filteredResults.length} building{filteredResults.length > 1 ? "s" : ""})</h3>

              {viewMode === "list" ? (
                <div className="list-view">
                  {filteredResults.map((building) => (
                    <div key={building.buildingId} className="building-group">
                      <h4>{building.buildingName}</h4>
                      {building.rooms.map((room) => (
                        <div
                          key={room.id}
                          className={`room-item ${room.isAvailable ? "avail" : "booked"}`}
                        >
                          <div className="room-info">
                            <span>{room.name}</span>
                            <span className={`badge ${room.isAvailable ? "avail" : "booked"}`}>
                              {room.isAvailable ? "✓ Available" : "✗ Booked"}
                            </span>
                          </div>
                          {canRequestBooking && room.isAvailable && (
                            <button
                              className="btn-book"
                              onClick={() =>
                                handleBookNow(room.id, building.buildingId)
                              }
                            >
                              Book Now
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <CalendarGrid
                  results={filteredResults}
                  startDate={startDate}
                  endDate={endDate}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarGrid({
  results,
  startDate,
  endDate,
}: {
  results: AvailabilityBuilding[];
  startDate: string;
  endDate: string;
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    days.push(dateStr);
  }

  return (
    <div className="calendar-grid">
      <div className="cal-header">
        <div className="col-room">Room</div>
        {days.map((day) => (
          <div key={day} className="col-day">
            {new Date(day).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        ))}
      </div>

      {results.map((building) =>
        building.rooms.map((room) => (
          <div key={`${building.buildingId}-${room.id}`} className="cal-row">
            <div className="col-room">
              <span className="bldg">{building.buildingName}</span>
              <span className="room">{room.name}</span>
            </div>
            {days.map((day) => (
              <div
                key={day}
                className={`col-day status-${room.isAvailable ? "avail" : "booked"}`}
              >
                {room.isAvailable ? "✓" : "✗"}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
