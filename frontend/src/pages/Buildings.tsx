import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createBuilding,
  deleteBuilding,
  getBuildings,
  updateBuilding,
} from "../api/api";
import type { Building } from "../api/api";
import { useAuth } from "../auth/AuthContext";

export function BuildingsPage() {
  const { user } = useAuth();
  const canMutate = user?.role === "ADMIN" || user?.role === "STAFF";

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      setBuildings(await getBuildings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load buildings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBuildings();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { setError("Name is required"); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      await createBuilding(trimmed);
      setNewName("");
      await loadBuildings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create building");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setError("Name is required"); return; }

    setIsUpdating(true);
    setError(null);
    try {
      await updateBuilding(id, trimmed);
      setEditingId(null);
      setEditingName("");
      await loadBuildings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update building");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteBuilding(id);
      await loadBuildings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete building");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <div className="page-header">
        <h2>Buildings</h2>
        <p>Manage campus buildings and facilities</p>
      </div>

      {canMutate && (
        <form className="card section-gap" onSubmit={handleCreate}>
          <div className="card-header">
            <h3>Add Building</h3>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="newBuildingName">Building name</label>
              <input
                id="newBuildingName"
                className="input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Science Block A"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Building"}
            </button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="loading-text">Loading buildings…</p>}
      {!loading && buildings.length === 0 && <p className="empty-text">No buildings found.</p>}

      {!loading && buildings.length > 0 && (
        <div className="data-list">
          {buildings.map((b) => {
            const isEditing = editingId === b.id;
            const isDeleting = deletingId === b.id;

            return (
              <div className="data-item" key={b.id}>
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
                      onClick={() => void handleUpdate(b.id)}
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
                      <div className="data-item-title">{b.name}</div>
                      <div className="data-item-subtitle">ID: {b.id}</div>
                    </div>
                    {canMutate && (
                      <div className="data-item-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setEditingId(b.id); setEditingName(b.name); }}
                        >
                          Rename
                        </button>
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