import { useEffect, useMemo, useState } from "react";
import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  type Holiday,
} from "../lib/api";
import { formatDateDDMMYYYY } from "../utils/datetime";
import { formatError } from "../utils/formatError";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedHolidays = useMemo(
    () =>
      [...holidays].sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }

        return a.id - b.id;
      }),
    [holidays],
  );

  const loadHolidays = async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await getHolidays();
      setHolidays(rows);
    } catch (loadError) {
      setError(formatError(loadError, "Failed to load holidays"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  const handleCreateHoliday = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Holiday name is required");
      return;
    }

    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before or equal to end date");
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await createHoliday({
        name: name.trim(),
        startDate,
        endDate,
        ...(description.trim() ? { description: description.trim() } : {}),
      });

      setName("");
      setStartDate("");
      setEndDate("");
      setDescription("");

      if (response.prunedTimetableBookings > 0) {
        setInfoMessage(
          `Holiday created. ${response.prunedTimetableBookings} timetable allocation booking(s) were pruned.`,
        );
      } else {
        setInfoMessage("Holiday created successfully.");
      }

      await loadHolidays();
    } catch (createError) {
      setError(formatError(createError, "Failed to create holiday"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: number) => {
    const shouldDelete = window.confirm("Delete this holiday?");

    if (!shouldDelete) {
      return;
    }

    setDeletingId(holidayId);
    setError(null);
    setInfoMessage(null);

    try {
      await deleteHoliday(holidayId);
      setInfoMessage("Holiday deleted.");
      await loadHolidays();
    } catch (deleteError) {
      setError(formatError(deleteError, "Failed to delete holiday"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Holidays</h1>
        <p className="mt-2 text-gray-600">
          Configure holiday dates. Timetable-allocated bookings overlapping holidays are pruned and skipped by default.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateHoliday}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="holidayName">Holiday Name</Label>
                <Input
                  id="holidayName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Independence Day"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holidayStartDate">Start Date</Label>
                <Input
                  id="holidayStartDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holidayEndDate">End Date</Label>
                <Input
                  id="holidayEndDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="holidayDescription">Description (optional)</Label>
                <Input
                  id="holidayDescription"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional details"
                  disabled={submitting}
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add Holiday"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {infoMessage && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configured Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-gray-600">Loading holidays...</p>}

          {!loading && orderedHolidays.length === 0 && (
            <p className="text-sm text-gray-600">No holidays configured.</p>
          )}

          {!loading &&
            orderedHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex flex-col gap-3 rounded-md border border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{holiday.name}</p>
                  <p className="text-sm text-gray-600">
                    {formatDateDDMMYYYY(holiday.startDate)} - {formatDateDDMMYYYY(holiday.endDate)}
                  </p>
                  {holiday.description && (
                    <p className="mt-1 text-sm text-gray-600">{holiday.description}</p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === holiday.id}
                  onClick={() => void handleDeleteHoliday(holiday.id)}
                >
                  {deletingId === holiday.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
