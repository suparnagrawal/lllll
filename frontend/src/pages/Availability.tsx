import { useState } from "react";
import type { FormEvent } from "react";
import { getAvailability, getBuildings } from "../api/api";
import type { AvailabilityBuilding, Building } from "../api/api";
import { useEffect } from "react";

export function AvailabilityPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [results, setResults] = useState<AvailabilityBuilding[] | null>(null);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [buildingId, setBuildingId] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try { setBuildings(await getBuildings()); } catch { /* ignored */ }
    })();
  }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!startAt || !endAt) {
      setError("Start and end times are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getAvailability(
        startAt,
        endAt,
        buildingId === "" ? undefined : buildingId,
      );
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check availability");
    } finally {
      setLoading(false);
    }
  };

  const totalRooms = results?.reduce((sum, b) => sum + b.rooms.length, 0) ?? 0;
  const availableRooms = results?.reduce(
    (sum, b) => sum + b.rooms.filter((r) => r.isAvailable).length,
    0,
  ) ?? 0;

  return (
    <section>
      <div className="page-header">
        <h2>Availability</h2>
        <p>Search room availability across buildings for a date/time range</p>
      </div>

      <form className="card section-gap" onSubmit={handleSearch}>
        <div className="card-header">
          <h3>Search</h3>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="availStartAt">Start</label>
            <input
              id="availStartAt"
              className="input"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="availEndAt">End</label>
            <input
              id="availEndAt"
              className="input"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="availBuilding">Building (optional)</label>
            <select
              id="availBuilding"
              className="input"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Searching…" : "Search Availability"}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="loading-text">Searching…</p>}

      {results !== null && !loading && (
        <>
          {results.length === 0 ? (
            <p className="empty-text">No rooms found for the selected criteria.</p>
          ) : (
            <>
              <div className="card section-gap" style={{ padding: "var(--space-3) var(--space-4)" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--gray-600)" }}>
                  <strong>{availableRooms}</strong> of <strong>{totalRooms}</strong> rooms available
                </span>
              </div>

              {results.map((group) => (
                <div className="availability-group" key={group.buildingId}>
                  <div className="availability-group-title">
                    {group.buildingName}
                  </div>
                  <div className="availability-rooms">
                    {group.rooms.map((room) => (
                      <div className="availability-room" key={room.id}>
                        <span className="availability-room-name">{room.name}</span>
                        <span
                          className={`badge ${room.isAvailable ? "badge-available" : "badge-occupied"}`}
                        >
                          {room.isAvailable ? "Available" : "Occupied"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
