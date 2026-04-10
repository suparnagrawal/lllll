import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  useApproveVenueChangeRequest,
  useCancelVenueChangeRequest,
  useCreateVenueChangeRequest,
  useRejectVenueChangeRequest,
  useVenueChangeOptions,
  useVenueChangeRequests,
} from "../hooks/useVenueChange";
import type { ChangeRequestStatus } from "../lib/api/types";
import { formatDateTimeDDMMYYYY } from "../utils/datetime";

type StatusFilter = "ALL" | ChangeRequestStatus;

const STATUS_OPTIONS: StatusFilter[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

function statusVariant(status: ChangeRequestStatus):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "PENDING") return "secondary";
  return "outline";
}

export default function VenueChangePage() {
  const { user } = useAuth();
  const canCreate = user?.role === "FACULTY";
  const canReview = user?.role === "STAFF" || user?.role === "ADMIN";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [courseId, setCourseId] = useState<string>("");
  const [currentBookingId, setCurrentBookingId] = useState<string>("");
  const [proposedRoomId, setProposedRoomId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const requestStatus = statusFilter === "ALL" ? undefined : statusFilter;

  const {
    data: requests = [],
    isLoading: isRequestsLoading,
    error: requestsError,
  } = useVenueChangeRequests(requestStatus);

  const {
    data: options,
    isLoading: isOptionsLoading,
    error: optionsError,
  } = useVenueChangeOptions(canCreate);

  const createMutation = useCreateVenueChangeRequest();
  const approveMutation = useApproveVenueChangeRequest();
  const rejectMutation = useRejectVenueChangeRequest();
  const cancelMutation = useCancelVenueChangeRequest();

  const courseOptions = options?.courses ?? [];
  const bookingOptions = options?.bookings ?? [];
  const roomOptions = options?.rooms ?? [];

  const filteredBookings = useMemo(
    () =>
      courseId
        ? bookingOptions.filter((booking) => String(booking.courseId) === courseId)
        : bookingOptions,
    [bookingOptions, courseId]
  );

  const roomLabelById = useMemo(
    () =>
      new Map(
        roomOptions.map((room) => [
          room.id,
          `${room.name} (${room.buildingName})`,
        ])
      ),
    [roomOptions]
  );

  const handleBookingChange = (value: string) => {
    setCurrentBookingId(value);

    const selected = bookingOptions.find((booking) => String(booking.id) === value);
    if (!selected) {
      return;
    }

    setCourseId(String(selected.courseId));
    if (!proposedRoomId) {
      setProposedRoomId(String(selected.roomId));
    }
  };

  const handleCreate = async () => {
    if (!courseId || !currentBookingId || !proposedRoomId || !reason.trim()) {
      setFormError("course, booking, proposed room, and reason are required");
      return;
    }

    setFormError(null);
    setActionError(null);

    try {
      await createMutation.mutateAsync({
        courseId: Number(courseId),
        currentBookingId: Number(currentBookingId),
        proposedRoomId: Number(proposedRoomId),
        reason: reason.trim(),
      });

      setCurrentBookingId("");
      setProposedRoomId("");
      setReason("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create venue change request");
    }
  };

  const setReviewNote = (requestId: number, value: string) => {
    setReviewNotes((prev) => ({ ...prev, [requestId]: value }));
  };

  const handleApprove = async (requestId: number) => {
    setActionError(null);
    const note = reviewNotes[requestId]?.trim();

    try {
      await approveMutation.mutateAsync({
        id: requestId,
        ...(note ? { reviewNote: note } : {}),
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to approve request");
    }
  };

  const handleReject = async (requestId: number) => {
    setActionError(null);
    const note = reviewNotes[requestId]?.trim();

    if (!note) {
      setActionError("Rejection note is required");
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: requestId, reviewNote: note });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to reject request");
    }
  };

  const handleCancel = async (requestId: number) => {
    setActionError(null);

    try {
      await cancelMutation.mutateAsync(requestId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to cancel request");
    }
  };

  const errorMessage =
    formError ??
    actionError ??
    (requestsError instanceof Error ? requestsError.message : null) ??
    (optionsError instanceof Error ? optionsError.message : null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Venue Change Requests</h1>
        <p className="text-gray-600 mt-2">
          Faculty can request room changes. Staff/Admin can review and decide requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="venueChangeStatus">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger id="venueChangeStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Venue Change Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOptionsLoading && <p className="text-sm text-gray-500">Loading dropdown options...</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venueCourse">Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger id="venueCourse">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseOptions.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.code} - {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueBooking">Current Booking</Label>
                <Select value={currentBookingId} onValueChange={handleBookingChange}>
                  <SelectTrigger id="venueBooking">
                    <SelectValue placeholder="Select booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBookings.map((booking) => (
                      <SelectItem key={`${booking.id}-${booking.courseId}`} value={String(booking.id)}>
                        #{booking.id} • {booking.courseCode} • {booking.roomName} ({formatDateTimeDDMMYYYY(booking.startAt)} - {formatDateTimeDDMMYYYY(booking.endAt)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueRoom">Proposed Room</Label>
                <Select value={proposedRoomId} onValueChange={setProposedRoomId}>
                  <SelectTrigger id="venueRoom">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptions.map((room) => (
                      <SelectItem key={room.id} value={String(room.id)}>
                        {room.name} ({room.buildingName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venueReason">Reason</Label>
              <Textarea
                id="venueReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why the venue needs to be changed"
              />
            </div>

            <Button type="button" onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Create Venue Change Request"}
            </Button>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Venue Change Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRequestsLoading && <p className="text-sm text-gray-500">Loading requests...</p>}

          {!isRequestsLoading && requests.length === 0 && (
            <p className="text-sm text-gray-500">No venue change requests found for the selected filter.</p>
          )}

          {!isRequestsLoading &&
            requests.map((row) => {
              const request = row.request;
              const currentRoomLabel = roomLabelById.get(row.currentBooking.roomId) ?? `Room #${row.currentBooking.roomId}`;
              const proposedRoomLabel = `${row.proposedRoom.name} (${row.proposedRoom.buildingName})`;
              const reviewNote = reviewNotes[request.id] ?? "";
              const isPending = request.status === "PENDING";
              const canCancel = user?.role === "FACULTY" && request.requestedBy === user.id && isPending;

              return (
                <div key={request.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">
                      {row.course.code} - {row.course.name}
                    </div>
                    <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
                  </div>

                  <div className="text-sm text-gray-700 space-y-1">
                    <p><strong>Requester:</strong> {row.requestedByUser.name} ({row.requestedByUser.email})</p>
                    <p><strong>Current Booking:</strong> #{request.currentBookingId} • {currentRoomLabel}</p>
                    <p><strong>Current Time:</strong> {formatDateTimeDDMMYYYY(row.currentBooking.startAt)} - {formatDateTimeDDMMYYYY(row.currentBooking.endAt)}</p>
                    <p><strong>Proposed Room:</strong> {proposedRoomLabel}</p>
                    <p><strong>Reason:</strong> {request.reason}</p>
                  </div>

                  {canReview && isPending && (
                    <div className="space-y-2">
                      <Label htmlFor={`venue-review-note-${request.id}`}>Review Note</Label>
                      <Input
                        id={`venue-review-note-${request.id}`}
                        value={reviewNote}
                        onChange={(event) => setReviewNote(request.id, event.target.value)}
                        placeholder="Optional for approve, required for reject"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleApprove(request.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => void handleReject(request.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {canCancel && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCancel(request.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending}
                      >
                        {cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
