import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

type Building = {
  id: number;
  name: string;
};

type Room = {
  id: number;
  name: string;
  buildingId: number;
};

export default function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [newBuilding, setNewBuilding] = useState("");
  const [rooms, setRooms] = useState<Record<number, Room[]>>({});
  const [newRoom, setNewRoom] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`${API}/buildings`)
      .then((res) => res.json())
      .then((data) => setBuildings(data.data));
  }, []);

  const toggle = async (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    if (!rooms[id]) {
      const res = await fetch(`${API}/buildings/${id}/rooms`);
      const data: Room[] = await res.json();
      setRooms((prev) => ({ ...prev, [id]: data }));
    }
  };

  const addBuilding = async () => {
    if (!newBuilding.trim()) return;

    const res = await fetch(`${API}/buildings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBuilding }),
    });

    const data = await res.json();
    if (!res.ok) return;

    setBuildings((prev) => [...prev, data.data]);
    setNewBuilding("");
  };

  const deleteBuilding = async (id: number) => {
    const res = await fetch(`${API}/buildings/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) return;

    setBuildings((prev) => prev.filter((b) => b.id !== id));
  };

  const addRoom = async (buildingId: number) => {
    const name = newRoom[buildingId];
    if (!name?.trim()) return;

    const res = await fetch(`${API}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, buildingId }),
    });

    const data: Room = await res.json();
    if (!res.ok) return;

    setRooms((prev) => ({
      ...prev,
      [buildingId]: [...(prev[buildingId] || []), data],
    }));

    setNewRoom((prev) => ({ ...prev, [buildingId]: "" }));
  };

  const deleteRoom = async (id: number, buildingId: number) => {
    const res = await fetch(`${API}/rooms/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) return;

    setRooms((prev) => ({
      ...prev,
      [buildingId]: prev[buildingId].filter((r) => r.id !== id),
    }));
  };

  return (
    <div className="flex h-screen">
      <div className="w-64 bg-gray-900 text-white p-4">
        <h1 className="text-xl font-bold mb-6">URA System</h1>
        <div className="p-2 bg-gray-800 rounded">Explorer</div>
      </div>

      <div className="flex-1 p-6 bg-gray-50 overflow-auto">
        <h2 className="text-2xl font-semibold mb-4">Buildings</h2>

        <div className="flex gap-2 mb-4">
          <input
            className="border p-2 rounded w-64"
            placeholder="New building"
            value={newBuilding}
            onChange={(e) => setNewBuilding(e.target.value)}
          />
          <button
            className="bg-black text-white px-4 py-2 rounded"
            onClick={addBuilding}
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {buildings.map((b) => (
            <div key={b.id} className="bg-white p-3 rounded shadow">
              <div className="flex justify-between items-center">
                <div
                  className="cursor-pointer font-medium"
                  onClick={() => toggle(b.id)}
                >
                  {b.name}
                </div>
                <button
                  className="text-red-500"
                  onClick={() => deleteBuilding(b.id)}
                >
                  Delete
                </button>
              </div>

              {expanded[b.id] && (
                <div className="mt-3 ml-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      className="border p-1 rounded"
                      placeholder="Room name"
                      value={newRoom[b.id] || ""}
                      onChange={(e) =>
                        setNewRoom((prev) => ({
                          ...prev,
                          [b.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="bg-gray-800 text-white px-2 rounded"
                      onClick={() => addRoom(b.id)}
                    >
                      Add
                    </button>
                  </div>

                  <ul className="space-y-1">
                    {(rooms[b.id] || []).map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between bg-gray-100 p-2 rounded"
                      >
                        {r.name}
                        <button
                          className="text-red-400"
                          onClick={() => deleteRoom(r.id, b.id)}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}