import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";
import {
  approveBookingRequest,
  approveEditRequest,
  cancelBookingRequest,
  createBookingRequest,
  forwardBookingRequest,
  getFacultyUsers,
  getBuildingMatrixAvailability,
  getManagedUsers,
  getBookingRequests,
  getBookings,
  getEditRequests,
  getRooms,
  getBuildings,
  getUserBuildingAssignments,
  rejectEditRequest,
  rejectBookingRequest,
} from "../lib/api";
import type {
  Booking,
  BookingEditRequest,
  BookingEventType,
  BookingRequest,
  BookingStatus,
  FacultyUser,
  Room,
  Building,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { DateInput } from "../components/DateInput";
import { formatDateTimeDDMMYYYY, getCurrentISTDateInputValue } from "../utils/datetime";
import { formatError } from "../utils/formatError";
import { buildHolidayWarningPrompt, isHolidayWarningError } from "../utils/holidayWarning";
import { formatRoomDisplayWithBuildingsArray } from "../utils/room";
import { BuildingSelector } from "./components/BuildingSelector";
import { RoomAvailabilityCard } from "./components/RoomAvailabilityCard";
import type {
  AvailabilityPrefill,
  BookingRequestPrefill,
} from "./bookingAvailabilityBridge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

type StatusFilter = "ALL" | BookingStatus;

const STATUS_OPTIONS: StatusFilter[] = [
  "ALL",
  "PENDING_FACULTY",
  "PENDING_STAFF",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_FACULTY: "Pending Faculty",
  PENDING_STAFF: "Pending Staff",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const EVENT_TYPE_OPTIONS: BookingEventType[] = [
  "QUIZ",
  "SEMINAR",
  "SPEAKER_SESSION",
  "MEETING",
  "CULTURAL_EVENT",
  "WORKSHOP",
  "CLASS",
  "OTHER",
];

const BOOKING_REQUESTS_PREFERENCES_KEY = "qol.bookingRequests.preferences.v1";

type BookingRequestPreferences = {
  statusFilter: StatusFilter;
  roomId: number | null;
  facultyId: number | null;
  startAt: string;
  endAt: string;
  eventType: BookingEventType;
  purpose: string;
  participantCount: string;
};

const DEFAULT_BOOKING_REQUEST_PREFERENCES: BookingRequestPreferences = {
  statusFilter: "ALL",
  roomId: null,
  facultyId: null,
  startAt: "",
  endAt: "",
  eventType: "OTHER",
  purpose: "",
  participantCount: "",
};

const BAND_FINDER_SLOT_GRANULARITY_MINUTES = 15;

type BandFinderOption = {
  roomId: number;
  roomName: string;
  buildingId: number;
  buildingName: string;
  capacity: number | null;
  roomType: string | null;
  startAt: string;
  endAt: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalDateTimeKey(dateKey: string, timeKey: string): string {
  return `${dateKey}T${timeKey}`;
}

function addMinutesToLocalDateTime(dateKey: string, timeKey: string, minutes: number): string {
  const base = new Date(`${dateKey}T${timeKey}:00`);

  if (Number.isNaN(base.getTime())) {
    return toLocalDateTimeKey(dateKey, timeKey);
  }

  base.setMinutes(base.getMinutes() + minutes);

  const year = base.getFullYear();
  const month = pad2(base.getMonth() + 1);
  const day = pad2(base.getDate());
  const hours = pad2(base.getHours());
  const mins = pad2(base.getMinutes());

  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function isStatusFilter(value: unknown): value is StatusFilter {
  return typeof value === "string" && (STATUS_OPTIONS as string[]).includes(value);
}

function isBookingEventType(value: unknown): value is BookingEventType {
  return typeof value === "string" && (EVENT_TYPE_OPTIONS as string[]).includes(value);
}

function readBookingRequestPreferences(): BookingRequestPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_BOOKING_REQUEST_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(BOOKING_REQUESTS_PREFERENCES_KEY);

    if (!raw) {
      return DEFAULT_BOOKING_REQUEST_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<BookingRequestPreferences>;

    return {
      statusFilter: isStatusFilter(parsed.statusFilter)
        ? parsed.statusFilter
        : "ALL",
      roomId:
        typeof parsed.roomId === "number" && Number.isFinite(parsed.roomId)
          ? parsed.roomId
          : null,
      facultyId:
        typeof parsed.facultyId === "number" && Number.isFinite(parsed.facultyId)
          ? parsed.facultyId
          : null,
      startAt: typeof parsed.startAt === "string" ? parsed.startAt : "",
      endAt: typeof parsed.endAt === "string" ? parsed.endAt : "",
      eventType: isBookingEventType(parsed.eventType)
        ? parsed.eventType
        : "OTHER",
      purpose: typeof parsed.purpose === "string" ? parsed.purpose : "",
      participantCount:
        typeof parsed.participantCount === "string" ? parsed.participantCount : "",
    };
  } catch {
    return DEFAULT_BOOKING_REQUEST_PREFERENCES;
  }
}

function statusBadgeVariant(status: BookingStatus): "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" {
  const map: Record<BookingStatus, "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"> = {
    PENDING_FACULTY: "outline",
    PENDING_STAFF: "secondary",
    APPROVED: "default",
    REJECTED: "destructive",
    CANCELLED: "outline",
  };
  return map[status];
}

type BookingRequestsPageProps = {
  prefill?: BookingRequestPrefill | null;
  onPrefillApplied?: () => void;
  onOpenAvailability?: (prefill: AvailabilityPrefill) => void;
};

export function BookingRequestsPage({
  prefill,
  onPrefillApplied,
  onOpenAvailability,
}: BookingRequestsPageProps) {
  const [initialPreferences] = useState<BookingRequestPreferences>(() =>
    readBookingRequestPreferences(),
  );
  const { user } = useAuth();
  const { pushToast } = useToast();
  const location = useLocation();
  const currentRole = user?.role ?? null;
  const isAdmin = currentRole === "ADMIN";
  const isStaff = currentRole === "STAFF";
  const isStudent = currentRole === "STUDENT";
  const canCreate =
    currentRole === "STUDENT" || currentRole === "FACULTY" || currentRole === "STAFF";

  // Get prefill from location state if available
  const locationPrefill = (location.state as any)?.prefill as BookingRequestPrefill | undefined;

  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<FacultyUser[]>([]);
  const [editRequests, setEditRequests] = useState<BookingEditRequest[]>([]);
  const [bookingsById, setBookingsById] = useState<Record<number, Booking>>({});
  const [adminUserNameById, setAdminUserNameById] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialPreferences.statusFilter);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState<number | "">(initialPreferences.roomId ?? "");
  const [facultyId, setFacultyId] = useState<number | "">(initialPreferences.facultyId ?? "");
  const [startAt, setStartAt] = useState(initialPreferences.startAt);
  const [endAt, setEndAt] = useState(initialPreferences.endAt);
  const [eventType, setEventType] = useState<BookingEventType>(initialPreferences.eventType);
  const [purpose, setPurpose] = useState(initialPreferences.purpose);
  const [participantCount, setParticipantCount] = useState(initialPreferences.participantCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const [staffBuildingIds, setStaffBuildingIds] = useState<number[]>([]);

  const [finderDate, setFinderDate] = useState(getCurrentISTDateInputValue());
  const [finderWindowStart, setFinderWindowStart] = useState("16:00");
  const [finderWindowEnd, setFinderWindowEnd] = useState("20:00");
  const [finderBandMinutes, setFinderBandMinutes] = useState<number>(60);
  const [finderMinCapacity, setFinderMinCapacity] = useState("");
  const [finderBuildingIds, setFinderBuildingIds] = useState<number[]>([]);
  const [finderBuildingsInitialized, setFinderBuildingsInitialized] = useState(false);
  const [finderOptions, setFinderOptions] = useState<BandFinderOption[]>([]);
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderError, setFinderError] = useState<string | null>(null);
  const [finderNotice, setFinderNotice] = useState<string | null>(null);

  const roomNameById = new Map(rooms.map((r) => [r.id, formatRoomDisplayWithBuildingsArray(r, buildings)]));
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const visibleFinderBuildings = useMemo(
    () =>
      isStaff
        ? buildings.filter((building) => staffBuildingIds.includes(building.id))
        : buildings,
    [buildings, isStaff, staffBuildingIds],
  );

  const loadAdminUsers = async () => {
    if (!isAdmin) {
      setAdminUserNameById({});
      return;
    }

    try {
      const response = await getManagedUsers({ page: 1, limit: 100 });
      const nextNameMap: Record<number, string> = {};

      for (const managedUser of response.data) {
        nextNameMap[managedUser.id] = managedUser.displayName ?? managedUser.name;
      }

      setAdminUserNameById(nextNameMap);
    } catch {
      setAdminUserNameById({});
    }
  };

  const loadRequests = async (filter: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await getBookingRequests(filter === "ALL" ? undefined : filter));
    } catch (e) {
      setError(formatError(e, "Failed to load booking requests"));
    } finally {
      setLoading(false);
    }
  };

  const loadEditRequests = async () => {
    try {
      const [editRows, bookingRows] = await Promise.all([
        getEditRequests(),
        getBookings(),
      ]);

      setEditRequests(editRows);
      const bookingMap: Record<number, Booking> = {};
      for (const booking of bookingRows) {
        bookingMap[booking.id] = booking;
      }
      setBookingsById(bookingMap);
    } catch (e) {
      setError(formatError(e, "Failed to load edit requests"));
    }
  };

  const loadRooms = async () => {
    try { setRooms(await getRooms()); }
    catch (e) { setError(formatError(e, "Failed to load rooms")); }
  };

  const loadBuildings = async () => {
    try { setBuildings(await getBuildings()); }
    catch (e) { setError(formatError(e, "Failed to load buildings")); }
  };

  const loadFacultyUsers = async () => {
    try {
      setFacultyUsers(await getFacultyUsers());
    } catch (e) {
      setError(formatError(e, "Failed to load faculty users"));
    }
  };

  useEffect(() => {
    void (async () => {
      await loadRooms();
      await loadBuildings();
      await loadEditRequests();

      if (isStudent) {
        await loadFacultyUsers();
      } else {
        setFacultyUsers([]);
        setFacultyId("");
      }
    })();
  }, [isStudent]);

  useEffect(() => {
    void loadRequests(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    void loadAdminUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isStaff || !user) {
      setStaffBuildingIds([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await getUserBuildingAssignments(user.id);
        if (!cancelled) {
          setStaffBuildingIds(response.buildingIds);
        }
      } catch {
        if (!cancelled) {
          setStaffBuildingIds([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStaff, user]);

  useEffect(() => {
    const visibleBuildingIdSet = new Set(visibleFinderBuildings.map((building) => building.id));
    setFinderBuildingIds((prev) => prev.filter((id) => visibleBuildingIdSet.has(id)));
  }, [visibleFinderBuildings]);

  useEffect(() => {
    if (finderBuildingsInitialized || visibleFinderBuildings.length === 0) {
      return;
    }

    setFinderBuildingIds(visibleFinderBuildings.map((building) => building.id));
    setFinderBuildingsInitialized(true);
  }, [finderBuildingsInitialized, visibleFinderBuildings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: BookingRequestPreferences = {
      statusFilter,
      roomId: roomId === "" ? null : roomId,
      facultyId: facultyId === "" ? null : facultyId,
      startAt,
      endAt,
      eventType,
      purpose,
      participantCount,
    };

    window.localStorage.setItem(
      BOOKING_REQUESTS_PREFERENCES_KEY,
      JSON.stringify(payload),
    );
  }, [statusFilter, roomId, facultyId, startAt, endAt, eventType, purpose, participantCount]);

  useEffect(() => {
    // Use locationPrefill if available, otherwise use prop prefill
    const effectivePrefill = locationPrefill || prefill;
    
    if (!effectivePrefill) {
      return;
    }

    setRoomId(effectivePrefill.roomId);
    setStartAt(effectivePrefill.startAt);
    setEndAt(effectivePrefill.endAt);
    setPurpose(effectivePrefill.purpose ?? "");
    setError(null);
    setPrefillMessage("Form prefilled from availability results.");
    onPrefillApplied?.();
  }, [onPrefillApplied, prefill, locationPrefill]);

  const handleFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
  };

  const clearRequestForm = () => {
    setRoomId("");
    setFacultyId("");
    setStartAt("");
    setEndAt("");
    setEventType("OTHER");
    setPurpose("");
    setParticipantCount("");
    setPrefillMessage(null);
  };

  const applyFinderOption = (option: BandFinderOption) => {
    setRoomId(option.roomId);
    setStartAt(option.startAt);
    setEndAt(option.endAt);
    setError(null);
    setPrefillMessage(
      `Form prefilled from time-band finder: ${option.buildingName} - ${option.roomName} (${option.startAt.slice(11, 16)} to ${option.endAt.slice(11, 16)}).`,
    );
  };

  const resetBandFinder = () => {
    setFinderDate(getCurrentISTDateInputValue());
    setFinderWindowStart("16:00");
    setFinderWindowEnd("20:00");
    setFinderBandMinutes(60);
    setFinderMinCapacity("");
    setFinderOptions([]);
    setFinderError(null);
    setFinderNotice(null);
    setFinderBuildingIds(visibleFinderBuildings.map((building) => building.id));
  };

  const handleBandFinderSearch = async () => {
    setFinderError(null);
    setFinderNotice(null);
    setFinderOptions([]);

    if (!finderDate) {
      setFinderError("Date is required.");
      return;
    }

    if (finderBuildingIds.length === 0) {
      setFinderError("Select at least one building.");
      return;
    }

    if (!finderWindowStart || !finderWindowEnd) {
      setFinderError("Start and end time are required.");
      return;
    }

    const windowStart = new Date(`${finderDate}T${finderWindowStart}:00`);
    const windowEnd = new Date(`${finderDate}T${finderWindowEnd}:00`);

    if (
      Number.isNaN(windowStart.getTime()) ||
      Number.isNaN(windowEnd.getTime()) ||
      windowStart.getTime() >= windowEnd.getTime()
    ) {
      setFinderError("Time range is invalid. End time must be after start time.");
      return;
    }

    const requestedBandMinutes = Number(finderBandMinutes);
    if (
      !Number.isInteger(requestedBandMinutes) ||
      requestedBandMinutes < BAND_FINDER_SLOT_GRANULARITY_MINUTES
    ) {
      setFinderError(`Band duration must be at least ${BAND_FINDER_SLOT_GRANULARITY_MINUTES} minutes.`);
      return;
    }

    const normalizedBandMinutes =
      Math.ceil(requestedBandMinutes / BAND_FINDER_SLOT_GRANULARITY_MINUTES) *
      BAND_FINDER_SLOT_GRANULARITY_MINUTES;

    const windowDurationMinutes = Math.floor(
      (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60),
    );

    if (normalizedBandMinutes > windowDurationMinutes) {
      setFinderError("Band duration exceeds the selected time range.");
      return;
    }

    const parsedMinCapacity =
      finderMinCapacity.trim().length > 0 ? Number(finderMinCapacity) : null;

    if (
      parsedMinCapacity !== null &&
      (!Number.isInteger(parsedMinCapacity) || parsedMinCapacity <= 0)
    ) {
      setFinderError("Minimum capacity must be a positive integer.");
      return;
    }

    setFinderLoading(true);

    try {
      const results = await Promise.allSettled(
        finderBuildingIds.map((buildingId) =>
          getBuildingMatrixAvailability(
            buildingId,
            finderDate,
            finderWindowStart,
            finderWindowEnd,
            BAND_FINDER_SLOT_GRANULARITY_MINUTES,
          ),
        ),
      );

      const requiredSlotCount = Math.max(
        1,
        normalizedBandMinutes / BAND_FINDER_SLOT_GRANULARITY_MINUTES,
      );
      let skippedBuildings = 0;
      const rawOptions: BandFinderOption[] = [];

      for (const result of results) {
        if (result.status !== "fulfilled") {
          skippedBuildings += 1;
          continue;
        }

        const matrixReport = result.value;

        for (const matrixRoom of matrixReport.matrix) {
          const roomMeta = roomById.get(matrixRoom.roomId);

          if (parsedMinCapacity !== null) {
            const roomCapacity = roomMeta?.capacity;
            if (roomCapacity === null || roomCapacity === undefined || roomCapacity < parsedMinCapacity) {
              continue;
            }
          }

          for (let startIdx = 0; startIdx <= matrixRoom.slots.length - requiredSlotCount; startIdx += 1) {
            let allAvailable = true;

            for (let offset = 0; offset < requiredSlotCount; offset += 1) {
              if (matrixRoom.slots[startIdx + offset]?.status !== "available") {
                allAvailable = false;
                break;
              }
            }

            if (!allAvailable) {
              continue;
            }

            const startTime = matrixRoom.slots[startIdx]?.time;
            if (!startTime) {
              continue;
            }

            const startAt = toLocalDateTimeKey(finderDate, startTime);
            const endAt = addMinutesToLocalDateTime(
              finderDate,
              startTime,
              normalizedBandMinutes,
            );

            const computedEnd = new Date(`${endAt}:00`);
            if (
              Number.isNaN(computedEnd.getTime()) ||
              computedEnd.getTime() > windowEnd.getTime()
            ) {
              continue;
            }

            rawOptions.push({
              roomId: matrixRoom.roomId,
              roomName: matrixRoom.roomName,
              buildingId: matrixReport.buildingId,
              buildingName: matrixReport.buildingName,
              capacity: roomMeta?.capacity ?? null,
              roomType: roomMeta?.roomType ?? null,
              startAt,
              endAt,
            });
          }
        }
      }

      const dedupedOptions = Array.from(
        rawOptions.reduce((map, option) => {
          const key = `${option.roomId}-${option.startAt}-${option.endAt}`;
          if (!map.has(key)) {
            map.set(key, option);
          }
          return map;
        }, new Map<string, BandFinderOption>()),
      )
        .map(([, option]) => option)
        .sort((a, b) => {
          const byStart = a.startAt.localeCompare(b.startAt);
          if (byStart !== 0) return byStart;

          const byBuilding = a.buildingName.localeCompare(b.buildingName);
          if (byBuilding !== 0) return byBuilding;

          return a.roomName.localeCompare(b.roomName);
        });

      setFinderOptions(dedupedOptions);

      const roundedMessage =
        normalizedBandMinutes !== requestedBandMinutes
          ? ` Duration rounded to ${normalizedBandMinutes} minutes (15-minute granularity).`
          : "";

      if (dedupedOptions.length === 0) {
        setFinderNotice(
          `No available options found for the selected constraints.${roundedMessage}`,
        );
      } else if (skippedBuildings > 0) {
        setFinderNotice(
          `Found ${dedupedOptions.length} option(s). ${skippedBuildings} selected building(s) were skipped due to access or data issues.${roundedMessage}`,
        );
      } else {
        setFinderNotice(`Found ${dedupedOptions.length} option(s).${roundedMessage}`);
      }
    } catch (searchError) {
      setFinderError(formatError(searchError, "Failed to search band options"));
    } finally {
      setFinderLoading(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (roomId === "") { setError("Room is required"); return; }
    if (isStudent && facultyId === "") { setError("Faculty selection is required"); return; }
    if (!startAt || !endAt) { setError("Start and end times are required"); return; }
    const trimmedPurpose = purpose.trim();
    if (!trimmedPurpose) { setError("Purpose is required"); return; }

    const trimmedParticipantCount = participantCount.trim();
    const parsedParticipantCount =
      trimmedParticipantCount.length > 0 ? Number(trimmedParticipantCount) : undefined;

    if (
      parsedParticipantCount !== undefined &&
      (!Number.isInteger(parsedParticipantCount) || parsedParticipantCount <= 0)
    ) {
      setError("Participant count must be a positive integer");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: {
        roomId: number;
        startAt: string;
        endAt: string;
        eventType: BookingEventType;
        purpose: string;
        participantCount?: number;
        facultyId?: number;
      } = {
        roomId,
        startAt,
        endAt,
        eventType,
        purpose: trimmedPurpose,
      };

      if (parsedParticipantCount !== undefined) {
        payload.participantCount = parsedParticipantCount;
      }

      if (isStudent) {
        payload.facultyId = Number(facultyId);
      }

      try {
        await createBookingRequest(payload);
      } catch (error) {
        if (!isHolidayWarningError(error)) {
          throw error;
        }

        const continueAnyway = window.confirm(buildHolidayWarningPrompt(error));

        if (!continueAnyway) {
          return;
        }

        await createBookingRequest({
          ...payload,
          overrideHolidayWarning: true,
        });
      }

      clearRequestForm();
      await loadRequests(statusFilter);
    } catch (e) {
      setError(formatError(e, "Failed to create request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckAvailability = () => {
    if (!onOpenAvailability) {
      return;
    }

    if (roomId === "") {
      setError("Room is required to check availability");
      return;
    }

    if (!startAt || !endAt) {
      setError("Start and end times are required to check availability");
      return;
    }

    const parsedStart = new Date(startAt).getTime();
    const parsedEnd = new Date(endAt).getTime();
    if (Number.isNaN(parsedStart) || Number.isNaN(parsedEnd) || parsedStart >= parsedEnd) {
      setError("Start must be earlier than end");
      return;
    }

    const selectedRoom = rooms.find((room) => room.id === roomId);
    onOpenAvailability({
      startAt,
      endAt,
      buildingId: selectedRoom?.buildingId,
      focusRoomId: roomId,
    });
  };

  const runAction = async (id: number, action: () => Promise<void>) => {
    setActingId(id);
    setError(null);
    try {
      await action();
      await loadRequests(statusFilter);
      await loadEditRequests();
    } catch (e) {
      setError(formatError(e, "Action failed"));
    } finally {
      setActingId(null);
    }
  };

  const runEditRequestAction = async (
    id: number,
    action: () => Promise<void>,
  ) => {
    setActingId(id);
    setError(null);

    try {
      await action();
      await loadEditRequests();
      await loadRequests(statusFilter);
    } catch (e) {
      setError(formatError(e, "Action failed"));
    } finally {
      setActingId(null);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    setActingId(requestId);
    setError(null);

    try {
      try {
        await approveBookingRequest(requestId);
      } catch (error) {
        if (!isHolidayWarningError(error)) {
          throw error;
        }

        const continueAnyway = window.confirm(buildHolidayWarningPrompt(error));

        if (!continueAnyway) {
          return;
        }

        await approveBookingRequest(requestId, {
          overrideHolidayWarning: true,
        });
      }

      await loadRequests(statusFilter);
      await loadEditRequests();
    } catch (error) {
      setError(formatError(error, "Action failed"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Booking Requests</h1>
        <p className="text-gray-600 mt-2">
          Submit and manage room booking requests
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            type="button"
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(s)}
          >
            {s === "ALL" ? "All" : STATUS_LABELS[s]}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={statusFilter === "ALL"}
          onClick={() => setStatusFilter("ALL")}
        >
          Reset Filter
        </Button>
      </div>

      {/* Time-Band Finder */}
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Find Available Time Bands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finderDate">Date</Label>
                <Input
                  id="finderDate"
                  type="date"
                  value={finderDate}
                  onChange={(event) => setFinderDate(event.target.value)}
                  disabled={finderLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finderWindowStart">Window Start</Label>
                <Input
                  id="finderWindowStart"
                  type="time"
                  value={finderWindowStart}
                  onChange={(event) => setFinderWindowStart(event.target.value)}
                  disabled={finderLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finderWindowEnd">Window End</Label>
                <Input
                  id="finderWindowEnd"
                  type="time"
                  value={finderWindowEnd}
                  onChange={(event) => setFinderWindowEnd(event.target.value)}
                  disabled={finderLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finderBandMinutes">Band Duration (minutes)</Label>
                <Input
                  id="finderBandMinutes"
                  type="number"
                  min={15}
                  step={15}
                  value={finderBandMinutes}
                  onChange={(event) => setFinderBandMinutes(Number(event.target.value || 0))}
                  disabled={finderLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finderMinCapacity">Minimum Capacity</Label>
                <Input
                  id="finderMinCapacity"
                  type="number"
                  min={1}
                  step={1}
                  value={finderMinCapacity}
                  onChange={(event) => setFinderMinCapacity(event.target.value)}
                  placeholder="Optional"
                  disabled={finderLoading}
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Allowed Buildings</p>
              {visibleFinderBuildings.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No buildings available for this account.
                </p>
              ) : (
                <BuildingSelector
                  buildings={visibleFinderBuildings}
                  selectedBuildingIds={finderBuildingIds}
                  onSelectionChange={setFinderBuildingIds}
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void handleBandFinderSearch()}
                disabled={finderLoading || visibleFinderBuildings.length === 0}
              >
                {finderLoading ? "Searching..." : "Search Options"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetBandFinder}
                disabled={finderLoading}
              >
                Reset Finder
              </Button>
            </div>

            {finderError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                {finderError}
              </div>
            )}

            {finderNotice && !finderError && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md">
                {finderNotice}
              </div>
            )}

            {finderOptions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Click a card to prefill the request form with that room and time band.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {finderOptions.map((option) => (
                    <RoomAvailabilityCard
                      key={`${option.roomId}-${option.startAt}-${option.endAt}`}
                      room={{
                        id: option.roomId,
                        name: option.roomName,
                        capacity: option.capacity,
                        roomType: option.roomType,
                      }}
                      buildingName={option.buildingName}
                      isFullyAvailable={true}
                      availableFrom={option.startAt.slice(11, 16)}
                      availableTo={option.endAt.slice(11, 16)}
                      onClick={() => applyFinderOption(option)}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* First Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newRequestRoomId">Room *</Label>
                  <Select
                    value={String(roomId)}
                    onValueChange={(value) =>
                      setRoomId(value === "" ? "" : Number(value))
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="newRequestRoomId">
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {formatRoomDisplayWithBuildingsArray(r, buildings)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRequestStartAt">Start *</Label>
                  <DateInput
                    id="newRequestStartAt"
                    mode="datetime"
                    value={startAt}
                    onChange={setStartAt}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRequestEndAt">End *</Label>
                  <DateInput
                    id="newRequestEndAt"
                    mode="datetime"
                    value={endAt}
                    onChange={setEndAt}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isStudent && (
                  <div className="space-y-2">
                    <Label htmlFor="newRequestFacultyId">
                      Faculty Approver *
                    </Label>
                    <Select
                      value={String(facultyId)}
                      onValueChange={(value) =>
                        setFacultyId(value === "" ? "" : Number(value))
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="newRequestFacultyId">
                        <SelectValue placeholder="Select a faculty member" />
                      </SelectTrigger>
                      <SelectContent>
                        {facultyUsers.map((faculty) => (
                          <SelectItem key={faculty.id} value={String(faculty.id)}>
                            {faculty.name}
                            {faculty.department ? ` (${faculty.department})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {facultyUsers.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No faculty accounts available. Contact admin to
                        provision faculty access.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="newRequestEventType">Event Type *</Label>
                  <Select
                    value={eventType}
                    onValueChange={(value) =>
                      setEventType(value as BookingEventType)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="newRequestEventType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Third Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newRequestPurpose">Purpose *</Label>
                  <Input
                    id="newRequestPurpose"
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Why do you need this room?"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRequestParticipantCount">
                    Participant Count (optional)
                  </Label>
                  <Input
                    id="newRequestParticipantCount"
                    type="number"
                    min={1}
                    step={1}
                    value={participantCount}
                    onChange={(e) => setParticipantCount(e.target.value)}
                    placeholder="e.g. 40"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || (isStudent && facultyUsers.length === 0)
                  }
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={handleCheckAvailability}
                >
                  Check Availability
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={clearRequestForm}
                >
                  Clear Form
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {prefillMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
          {prefillMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading and Empty States */}
      {loading && (
        <p className="text-gray-600 text-center py-8">Loading requests...</p>
      )}
      {!loading && requests.length === 0 && (
        <p className="text-gray-600 text-center py-8">No booking requests found.</p>
      )}

      {/* Requests List */}
      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => {
            const isPendingFaculty = req.status === "PENDING_FACULTY";
            const isPendingStaff = req.status === "PENDING_STAFF";
            const isApproved = req.status === "APPROVED";
            const isCancellableStatus = isPendingFaculty || isPendingStaff || isApproved;
            const isOwnRequest = user ? req.userId === user.id : false;
            const isFacultyApprover = user ? req.facultyId === user.id : false;
            const isActing = actingId === req.id;

            const canForward = currentRole === "FACULTY" && isPendingFaculty;
            const canApprove =
              (currentRole === "STAFF" || currentRole === "ADMIN") &&
              isPendingStaff;
            const canReject =
              (currentRole === "FACULTY" && isPendingFaculty) ||
              ((currentRole === "STAFF" || currentRole === "ADMIN") &&
                isPendingStaff);
            const canCancel =
              (currentRole === "ADMIN" || isOwnRequest || isFacultyApprover) &&
              isCancellableStatus;

            const hasActions = canForward || canApprove || canReject || canCancel;
            const requestedByLabel =
              req.userId === null
                ? "-"
                : (adminUserNameById[req.userId] ?? "Unknown User");
            const facultyApproverLabel =
              req.facultyId === null
                ? "Unassigned"
                : (adminUserNameById[req.facultyId] ?? "Unknown User");

            return (
              <Card key={req.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      Room Booking Request
                    </CardTitle>
                    <Badge variant={statusBadgeVariant(req.status)}>
                      {STATUS_LABELS[req.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Request Details */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="font-semibold">Room:</span>{" "}
                      <span>{roomNameById.get(req.roomId) ?? "Unknown Room"}</span>
                    </div>
                    <div>
                      <span className="font-semibold">From:</span>{" "}
                      <span>{formatDateTimeDDMMYYYY(req.startAt)}</span>
                    </div>
                    <div>
                      <span className="font-semibold">To:</span>{" "}
                      <span>{formatDateTimeDDMMYYYY(req.endAt)}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Type:</span>{" "}
                      <span>{req.eventType.replace(/_/g, " ")}</span>
                    </div>
                    {req.participantCount !== null && (
                      <div>
                        <span className="font-semibold">Participants:</span>{" "}
                        <span>{req.participantCount}</span>
                      </div>
                    )}
                    {isAdmin && (
                      <>
                        <div>
                          <span className="font-semibold">Requested By:</span>{" "}
                          <span>{requestedByLabel}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Faculty Approver:</span>{" "}
                          <span>{facultyApproverLabel}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Created:</span>{" "}
                          <span>{formatDateTimeDDMMYYYY(req.createdAt)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Purpose */}
                  {req.purpose && (
                    <div className="border-t pt-3 text-sm">
                      <span className="font-semibold">Purpose:</span>{" "}
                      <p className="mt-1">{req.purpose}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {hasActions && (
                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      {canForward && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={isActing}
                          onClick={() =>
                            void runAction(req.id, () =>
                              forwardBookingRequest(req.id)
                            )
                          }
                        >
                          {isActing ? "Processing..." : "Forward to Staff"}
                        </Button>
                      )}
                      {canApprove && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={isActing}
                          onClick={() => void handleApproveRequest(req.id)}
                        >
                          {isActing ? "Processing..." : "Approve"}
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isActing}
                          onClick={() =>
                            void runAction(req.id, () =>
                              rejectBookingRequest(req.id)
                            )
                          }
                        >
                          {isActing ? "Processing..." : "Reject"}
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={() =>
                            void runAction(req.id, () =>
                              cancelBookingRequest(req.id)
                            )
                          }
                        >
                          {isActing ? "Processing..." : "Cancel"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editRequests.length === 0 ? (
            <p className="text-gray-600">No edit requests found.</p>
          ) : (
            editRequests.map((editRequest) => {
              const isPending = editRequest.status === "PENDING";
              const isReviewer = currentRole === "ADMIN" || currentRole === "STAFF";
              const canReview = isReviewer && isPending;
              const originalBooking = bookingsById[editRequest.bookingId];
              const originalRoomLabel =
                originalBooking
                  ? roomNameById.get(originalBooking.roomId) ?? `Room #${originalBooking.roomId}`
                  : `Booking #${editRequest.bookingId}`;
              const proposedRoomLabel =
                editRequest.proposedRoomId === null
                  ? originalRoomLabel
                  : roomNameById.get(editRequest.proposedRoomId) ?? `Room #${editRequest.proposedRoomId}`;

              const originalStart = originalBooking?.startAt
                ? formatDateTimeDDMMYYYY(originalBooking.startAt)
                : "-";
              const originalEnd = originalBooking?.endAt
                ? formatDateTimeDDMMYYYY(originalBooking.endAt)
                : "-";
              const proposedStart = editRequest.proposedStartAt
                ? formatDateTimeDDMMYYYY(editRequest.proposedStartAt)
                : originalStart;
              const proposedEnd = editRequest.proposedEndAt
                ? formatDateTimeDDMMYYYY(editRequest.proposedEndAt)
                : originalEnd;
              const isActing = actingId === editRequest.id;

              return (
                <div key={editRequest.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Edit Request #{editRequest.id}</p>
                      <p className="text-sm text-gray-600">Booking #{editRequest.bookingId}</p>
                    </div>
                    <Badge variant={editRequest.status === "APPROVED" ? "default" : editRequest.status === "REJECTED" ? "destructive" : "secondary"}>
                      {editRequest.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border p-3 bg-gray-50">
                      <p className="font-semibold mb-1">Original</p>
                      <p>Room: {originalRoomLabel}</p>
                      <p>From: {originalStart}</p>
                      <p>To: {originalEnd}</p>
                    </div>
                    <div className="rounded-md border p-3 bg-blue-50">
                      <p className="font-semibold mb-1">Proposed</p>
                      <p>Room: {proposedRoomLabel}</p>
                      <p>From: {proposedStart}</p>
                      <p>To: {proposedEnd}</p>
                    </div>
                  </div>

                  {canReview && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isActing}
                        onClick={() =>
                          void runEditRequestAction(editRequest.id, async () => {
                            await approveEditRequest(editRequest.id);
                            pushToast("success", "Edit request approved");
                          })
                        }
                      >
                        {isActing ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isActing}
                        onClick={() =>
                          void runEditRequestAction(editRequest.id, async () => {
                            await rejectEditRequest(editRequest.id);
                            pushToast("info", "Edit request rejected");
                          })
                        }
                      >
                        {isActing ? "Processing..." : "Reject"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}