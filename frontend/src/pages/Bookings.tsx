import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useBookings, useCreateBooking, useDeleteBooking } from "../hooks/useBookings";
import { useBuildings } from "../hooks/useBuildings";
import { useRooms } from "../hooks/useRooms";
import { useManagedUsers } from "../hooks/useUsers";
import type { Booking } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { DateInput } from "../components/DateInput";
import { formatDateTimeDDMMYYYY } from "../utils/datetime";
import { formatRoomDisplayWithBuildingsArray } from "../utils/room";

export function BookingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canMutate = user?.role === "ADMIN" || user?.role === "STAFF";

  if (!canMutate) {
    return (
      <section>
        <div className="page-header">
          <h2>Bookings</h2>
          <p>View and manage confirmed room bookings</p>
        </div>
        <div className="alert alert-warning">
          <p>This page is only available to Admin and Staff users. Please contact your administrator if you need access.</p>
        </div>
      </section>
    );
  }

  // Filters
  const [filterRoomId, setFilterRoomId] = useState<number | "">("");
  const [filterBuildingId, setFilterBuildingId] = useState<number | "">("");
  const [filterStartAt, setFilterStartAt] = useState("");
  const [filterEndAt, setFilterEndAt] = useState("");

  // Create form
  const [newRoomId, setNewRoomId] = useState<number | "">(""); 
  const [newStartAt, setNewStartAt] = useState("");
  const [newEndAt, setNewEndAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Build filters object for query
  const filters = useMemo<Record<string, number | string> | undefined>(() => {
    const f: Record<string, number | string> = {};
    if (filterRoomId !== "") f.roomId = filterRoomId;
    if (filterBuildingId !== "") f.buildingId = filterBuildingId;
    if (filterStartAt) f.startAt = filterStartAt;
    if (filterEndAt) f.endAt = filterEndAt;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filterRoomId, filterBuildingId, filterStartAt, filterEndAt]);

  // Queries
  const { data: bookings = [], isLoading, error: bookingsError } = useBookings(filters);
  const { data: rooms = [] } = useRooms();
  const { data: buildings = [] } = useBuildings();
  const { data: managedUsersResponse } = useManagedUsers(
    isAdmin ? { page: 1, limit: 100 } : undefined
  );

  // Build admin user name map
  const adminUserNameById = useMemo(() => {
    if (!isAdmin || !managedUsersResponse) return {};
    const map: Record<number, string> = {};
    for (const user of managedUsersResponse.data) {
      map[user.id] = user.displayName ?? user.name;
    }
    return map;
  }, [isAdmin, managedUsersResponse]);

  const roomNameById = useMemo(
    () => new Map(rooms.map((r) => [r.id, formatRoomDisplayWithBuildingsArray(r, buildings)])),
    [rooms, buildings]
  );

  const bookingSourceLabel = useCallback(
    (source: Booking["source"]) => source.replace(/_/g, " "),
    []
  );

  // Mutations
  const createBookingMutation = useCreateBooking();
  const deleteBookingMutation = useDeleteBooking();

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newRoomId === "") { 
      setCreateError("Room is required"); 
      return; 
    }
    if (!newStartAt || !newEndAt) { 
      setCreateError("Start and end times are required"); 
      return; 
    }

    setCreateError(null);
    try {
      await createBookingMutation.mutateAsync({ 
        roomId: newRoomId, 
        startAt: newStartAt, 
        endAt: newEndAt 
      });
      setNewRoomId("");
      setNewStartAt("");
      setNewEndAt("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create booking");
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setCreateError(null);
    try {
      await deleteBookingMutation.mutateAsync(id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to delete booking");
    } finally {
      setDeletingId(null);
    }
  };

  const error = bookingsError || createBookingMutation.error || deleteBookingMutation.error;
  const isSubmitting = createBookingMutation.isPending;

  return (
    <section>
      <div className="page-header">
        <h2>Bookings</h2>
        <p>View and manage confirmed room bookings</p>
      </div>

      {/* Filter */}
      <form className="card section-gap" onSubmit={(e) => { e.preventDefault(); }}>
        <div className="card-header">
          <h3>Filters</h3>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="filterBuilding">Building</label>
            <select
              id="filterBuilding"
              className="input"
              value={filterBuildingId}
              onChange={(e) => setFilterBuildingId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">All Buildings</option>
              {buildings?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filterRoom">Room</label>
            <select
              id="filterRoom"
              className="input"
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">All Rooms</option>
              {rooms?.map((r) => (
                <option key={r.id} value={r.id}>{formatRoomDisplayWithBuildingsArray(r, buildings)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filterStartAt">From</label>
            <DateInput
              id="filterStartAt"
              mode="datetime"
              value={filterStartAt}
              onChange={setFilterStartAt}
            />
          </div>
          <div className="form-field">
            <label htmlFor="filterEndAt">To</label>
            <DateInput
              id="filterEndAt"
              mode="datetime"
              value={filterEndAt}
              onChange={setFilterEndAt}
            />
          </div>
        </div>
      </form>

      {/* Create form */}
      {canMutate && (
        <form className="card section-gap" onSubmit={handleCreate}>
          <div className="card-header">
            <h3>Create Booking</h3>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="newBookingRoom">Room</label>
              <select
                id="newBookingRoom"
                className="input"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={isSubmitting}
              >
                <option value="">Select a room</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>{formatRoomDisplayWithBuildingsArray(r, buildings)}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="newBookingStartAt">Start</label>
              <DateInput
                id="newBookingStartAt"
                mode="datetime"
                value={newStartAt}
                onChange={setNewStartAt}
                disabled={isSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="newBookingEndAt">End</label>
              <DateInput
                id="newBookingEndAt"
                mode="datetime"
                value={newEndAt}
                onChange={setNewEndAt}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Booking"}
            </button>
          </div>
        </form>
      )}

      {(error || createError) && <div className="alert alert-error">{error?.message || createError}</div>}
      {isLoading && <p className="loading-text">Loading bookings…</p>}
      {!isLoading && bookings.length === 0 && <p className="empty-text">No bookings found.</p>}

      {!isLoading && bookings.length > 0 && (
        <div className="data-list">
          {bookings.map((b) => {
            const isDeleting = deletingId === b.id;
            const approvedByLabel =
              b.approvedBy === null
                ? "-"
                : (adminUserNameById[b.approvedBy] ?? "Unknown User");
            const requestLabel = b.requestId === null ? "-" : String(b.requestId);

            return (
              <div className="data-item" key={b.id}>
                <div className="data-item-content">
                  <div className="data-item-title">
                    {roomNameById.get(b.roomId) ?? "Unknown Room"}
                  </div>
                  <div className="data-item-subtitle">
                    {formatDateTimeDDMMYYYY(b.startAt)} – {formatDateTimeDDMMYYYY(b.endAt)}
                  </div>
                  {isAdmin && (
                    <div className="empty-text" style={{ marginTop: "var(--space-1)" }}>
                      Source: {bookingSourceLabel(b.source)} · Source Ref: {b.sourceRef ?? "-"} · Request Link: {requestLabel} · Approved By: {approvedByLabel} · Approved At: {b.approvedAt ? formatDateTimeDDMMYYYY(b.approvedAt) : "-"}
                    </div>
                  )}
                </div>
                {canMutate && (
                  <div className="data-item-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={isDeleting}
                      onClick={() => void handleDelete(b.id)}
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
