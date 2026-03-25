import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createRoom,
  deleteRoom,
  getBuildings,
  getRooms,
  updateRoom,
} from "../api/api";
import type { Building, Room } from "../api/api";
import { useAuth } from "../auth/AuthContext";

export function RoomsPage() {
  const { user } = useAuth();
  const canMutate = user?.role === "ADMIN" || user?.role === "STAFF";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | "all">("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newBuildingId, setNewBuildingId] = useState<number | "">(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));

  const loadBuildings = async () => {
    try {
      setBuildings(await getBuildings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buildings");
    }
  };

  const loadRooms = async (buildingId: number | "all") => {
    setLoading(true);
    setError(null);
    try {
      setRooms(await getRooms(buildingId === "all" ? undefined : buildingId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadBuildings();
      await loadRooms("all");
    })();
  }, []);

  const handleFilterChange = async (value: string) => {
    const next = value === "all" ? "all" as const : Number(value);
    setSelectedBuildingId(next);
    await loadRooms(next);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { setError("Room name is required"); return; }
    if (newBuildingId === "") { setError("Building is required"); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      await createRoom(trimmed, newBuildingId);
      setNewName("");
      await loadRooms(selectedBuildingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setError("Room name is required"); return; }

    setIsUpdating(true);
    setError(null);
    try {
      await updateRoom(id, trimmed);
      setEditingId(null);
      setEditingName("");
      await loadRooms(selectedBuildingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update room");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteRoom(id);
      await loadRooms(selectedBuildingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete room");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <div className="page-header">
        <h2>Rooms</h2>
        <p>View and manage rooms across campus buildings</p>
      </div>

      {/* Filter */}
      <div className="card section-gap">
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="roomBuildingFilter">Filter by building</label>
            <select
              id="roomBuildingFilter"
              className="input"
              value={selectedBuildingId}
              onChange={(e) => void handleFilterChange(e.target.value)}
            >
              <option value="all">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Create form */}
      {canMutate && (
        <form className="card section-gap" onSubmit={handleCreate}>
          <div className="card-header">
            <h3>Add Room</h3>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="newRoomName">Room name</label>
              <input
                id="newRoomName"
                className="input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Lab 101"
                disabled={isSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="newRoomBuilding">Building</label>
              <select
                id="newRoomBuilding"
                className="input"
                value={newBuildingId}
                onChange={(e) => setNewBuildingId(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={isSubmitting}
              >
                <option value="">Select a building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Room"}
            </button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="loading-text">Loading rooms…</p>}
      {!loading && rooms.length === 0 && <p className="empty-text">No rooms found.</p>}

      {!loading && rooms.length > 0 && (
        <div className="data-list">
          {rooms.map((room) => {
            const isEditing = editingId === room.id;
            const isDeleting = deletingId === room.id;

            return (
              <div className="data-item" key={room.id}>
                {isEditing ? (
                  <div className="inline-edit">
                    <input
                      className="input"
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      disabled={isUpdating}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isUpdating}
                      onClick={() => void handleUpdate(room.id)}
                    >
                      {isUpdating ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isUpdating}
                      onClick={() => { setEditingId(null); setEditingName(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="data-item-content">
                      <div className="data-item-title">{room.name}</div>
                      <div className="data-item-subtitle">
                        {buildingNameById.get(room.buildingId) ?? `Building #${room.buildingId}`} · ID: {room.id}
                      </div>
                    </div>
                    {canMutate && (
                      <div className="data-item-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setEditingId(room.id); setEditingName(room.name); }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(room.id)}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}