export type UserRole =
  | "ADMIN"
  | "STAFF"
  | "FACULTY"
  | "STUDENT"
  | "PENDING_ROLE";

export type SetupRole = "STUDENT" | "FACULTY" | "ADMIN";

export type AuthMethod = "email" | "google";

export type AuthUser = {
  id: number;
  name: string;
  email?: string;
  department?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  registeredVia?: string;
  buildings?: Array<{ id: number; name: string }>;
};

export type AssignableUserRole = "ADMIN" | "STAFF" | "FACULTY" | "STUDENT";

export type FacultyUser = {
  id: number;
  name: string;
  email: string;
  department: string | null;
  avatarUrl: string | null;
};

export type ManagedUser = {
  id: number;
  name: string;
  displayName: string | null;
  email: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  registeredVia: string;
  firstLogin: boolean;
  createdAt: string;
  assignedBuildings: Building[];
};

export type ManagedUsersPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ManagedUsersListResponse = {
  data: ManagedUser[];
  pagination: ManagedUsersPagination;
};

export type StaffBuildingAssignmentsResponse = {
  userId: number;
  buildingIds: number[];
  buildings: Building[];
};

export type RoomType =
  | "LECTURE_HALL"
  | "CLASSROOM"
  | "SEMINAR_ROOM"
  | "COMPUTER_LAB"
  | "CONFERENCE_ROOM"
  | "AUDITORIUM"
  | "WORKSHOP"
  | "OTHER";

export type Building = {
  id: number;
  name: string;
  location: string | null;
  managedByStaffId: number | null;
};

export type Room = {
  id: number;
  name: string;
  buildingId: number;
  capacity: number | null;
  roomType: RoomType | null;
  hasProjector: boolean;
  hasMic: boolean;
  accessible: boolean;
  equipmentList: string | null;
};

export type BookingStatus =
  | "PENDING_FACULTY"
  | "PENDING_STAFF"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type BookingEventType =
  | "QUIZ"
  | "SEMINAR"
  | "SPEAKER_SESSION"
  | "MEETING"
  | "CULTURAL_EVENT"
  | "WORKSHOP"
  | "CLASS"
  | "OTHER";

export type BookingSource =
  | "MANUAL_REQUEST"
  | "TIMETABLE_ALLOCATION"
  | "SLOT_CHANGE"
  | "VENUE_CHANGE";

export type BookingRequest = {
  id: number;
  userId: number | null;
  facultyId: number | null;
  roomId: number;
  startAt: string;
  endAt: string;
  eventType: BookingEventType;
  purpose: string;
  participantCount: number | null;
  status: BookingStatus;
  createdAt: string;
};

export type Booking = {
  id: number;
  roomId: number;
  startAt: string;
  endAt: string;
  requestId: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  source: BookingSource;
  sourceRef: string | null;
};

export type BookingDetail = {
  id: number;
  startAt: string;
  endAt: string;
  activityName?: string;
  bookedBy?: string;
  contactInfo?: string;
  purpose?: string;
  hasAccess: boolean;
  visibilityLevel: 'full' | 'restricted' | 'none';
};

export type NotificationType =
  | "BOOKING_REQUEST_CREATED"
  | "BOOKING_REQUEST_FORWARDED"
  | "BOOKING_REQUEST_APPROVED"
  | "BOOKING_REQUEST_REJECTED"
  | "BOOKING_REQUEST_CANCELLED";

export type AppNotification = {
  notificationId: number;
  recipientId: number;
  subject: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  sentAt: string;
};

export type NotificationsResponse = {
  data: AppNotification[];
  unreadCount: number;
};

export type BookingPruneScope = "all" | "slot-system";

export type BookingPruneResult = {
  scope: BookingPruneScope;
  deletedBookings: number;
  slotSystemId?: number;
};

export type AvailabilityRoom = {
  id: number;
  name: string;
  isAvailable: boolean;
  bookings?: BookingDetail[];
};

export type AvailabilityBuilding = {
  buildingId: number;
  buildingName: string;
  rooms: AvailabilityRoom[];
};

export type TimelineSegment = {
  start: string;      // ISO 8601 datetime
  end: string;        // ISO 8601 datetime
  status: 'free' | 'booked';
  booking?: {
    id: number;
    title?: string;
    startAt: string;
    endAt: string;
    bookedBy?: string;
    activityName?: string;
    contactInfo?: string;
    purpose?: string;
  };
  isRestricted?: boolean;  // true if booking details are masked
};

export type RoomDayTimeline = {
  room: {
    id: number;
    name: string;
    buildingId: number;
    buildingName: string;
  };
  date: string;  // YYYY-MM-DD
  segments: TimelineSegment[];
};

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type SlotSystem = {
  id: number;
  name: string;
  createdAt: string;
};

export type SlotDay = {
  id: number;
  slotSystemId: number;
  dayOfWeek: DayOfWeek;
  orderIndex: number;
  laneCount: number;
};

export type SlotTimeBand = {
  id: number;
  slotSystemId: number;
  startTime: string;
  endTime: string;
  orderIndex: number;
};

export type SlotBlock = {
  id: number;
  slotSystemId: number;
  dayId: number;
  startBandId: number;
  laneIndex: number;
  rowSpan: number;
  label: string;
  createdAt: string;
};

export type SlotFullGrid = {
  slotSystem: SlotSystem;
  days: SlotDay[];
  timeBands: SlotTimeBand[];
  blocks: SlotBlock[];
};

export type TimetableImportRowStatus =
  | "VALID_AND_AUTOMATABLE"
  | "UNRESOLVED_SLOT"
  | "UNRESOLVED_ROOM"
  | "AMBIGUOUS_CLASSROOM"
  | "DUPLICATE_ROW"
  | "CONFLICTING_MAPPING"
  | "MISSING_REQUIRED_FIELD"
  | "OTHER_PROCESSING_ERROR";

export type TimetableImportPreviewRow = {
  rowId: number;
  rowIndex: number;
  courseCode: string;
  slot: string;
  classroom: string;
  classification: TimetableImportRowStatus;
  reasons: string[];
  suggestions: string[];
  parsedBuilding: string | null;
  parsedRoom: string | null;
  resolvedSlotLabel: string | null;
  resolvedRoomId: number | null;
  auxiliaryData: Record<string, string>;
};

export type TimetableImportPreviewReport = {
  batchId: number;
  reused: boolean;
  status: "PREVIEWED" | "COMMITTED";
  slotSystemId: number;
  termStartDate: string;
  termEndDate: string;
  processedRows: number;
  validRows: number;
  unresolvedRows: number;
  warnings: string[];
  savedDecisions: TimetableImportSavedDecision[];
  rows: TimetableImportPreviewRow[];
  auxiliaryHeaders: string[];
};

export type TimetableImportSavedDecision = {
  rowId: number;
  action: "AUTO" | "RESOLVE" | "SKIP";
  resolvedSlotLabel: string | null;
  resolvedRoomId: number | null;
  createSlot: TimetableImportCreateSlotDecision | null;
  createRoom: TimetableImportCreateRoomDecision | null;
  updatedAt: string;
};

export type TimetableImportBatchSummary = {
  batchId: number;
  slotSystemId: number;
  slotSystemName: string;
  fileName: string;
  status: "PREVIEWED" | "COMMITTED";
  validRows: number;
  resolvedRows: number;
  unresolvedRows: number;
  termStartDate: string;
  termEndDate: string;
  createdAt: string;
  committedAt: string | null;
};

export type TimetableImportDecisionSaveReport = {
  batchId: number;
  status: "PREVIEWED" | "COMMITTED";
  savedDecisions: TimetableImportSavedDecision[];
};

export type TimetableImportBatchDeleteReport = {
  batchId: number;
  status: "DELETED";
  deletedBookings: number;
};

export type TimetableImportTransferRowReport = {
  sourceBatchId: number;
  sourceRowId: number;
  targetSlotSystemId: number;
  targetBatchId: number;
  targetProcessedRows: number;
  targetBatchStatus: "PREVIEWED" | "COMMITTED";
};

export type TimetableImportCreateSlotDecision = {
  dayId: number;
  startBandId: number;
  endBandId: number;
  laneIndex?: number;
  label?: string;
};

export type TimetableImportCreateRoomDecision = {
  buildingName: string;
  roomName: string;
};

export type TimetableImportCommitDecision = {
  rowId: number;
  action: "AUTO" | "RESOLVE" | "SKIP";
  resolvedSlotLabel?: string;
  resolvedRoomId?: number;
  createSlot?: TimetableImportCreateSlotDecision;
  createRoom?: TimetableImportCreateRoomDecision;
};

export type TimetableImportCommitRowResult = {
  rowId: number;
  rowIndex: number;
  classification: TimetableImportRowStatus;
  action: "AUTO" | "RESOLVE" | "SKIP";
  created: number;
  failed: number;
  skipped: number;
  alreadyProcessed: number;
  unresolved: number;
  reasons: string[];
  bookingConflictReasons: string[];
};

export type TimetableImportConflictingBooking = {
  rowId: number;
  rowIndex: number;
  occurrenceId: number;
  roomId: number;
  startAt: string;
  endAt: string;
  message: string;
};

export type TimetableImportCommitReport = {
  batchId: number;
  status: "COMMITTED" | "ALREADY_COMMITTED";
  processedRows: number;
  autoCreatedBookings: number;
  alreadyProcessedBookings: number;
  failedOccurrences: number;
  unresolvedRows: number;
  skippedRows: number;
  bookingConflictRows: number;
  bookingConflictOccurrences: number;
  conflictingBookings: TimetableImportConflictingBooking[];
  rowResults: TimetableImportCommitRowResult[];
  warnings: string[];
};

export type TimetableImportProcessedOccurrenceStatus =
  | "PENDING"
  | "CREATED"
  | "FAILED"
  | "SKIPPED"
  | "UNRESOLVED"
  | "ALREADY_PROCESSED";

export type TimetableImportProcessedOccurrence = {
  occurrenceId: number;
  status: TimetableImportProcessedOccurrenceStatus;
  roomId: number;
  startAt: string;
  endAt: string;
  sourceRef: string | null;
  errorMessage: string | null;
  booking: Booking | null;
};

export type TimetableImportProcessedRow = {
  rowId: number;
  rowIndex: number;
  classification: TimetableImportRowStatus;
  courseCode: string;
  slot: string;
  classroom: string;
  action: "AUTO" | "RESOLVE" | "SKIP";
  resolvedSlotLabel: string | null;
  resolvedRoomId: number | null;
  createSlot: TimetableImportCreateSlotDecision | null;
  createRoom: TimetableImportCreateRoomDecision | null;
  created: number;
  failed: number;
  skipped: number;
  alreadyProcessed: number;
  unresolved: number;
  reasons: string[];
  bookingConflictReasons: string[];
  occurrences: TimetableImportProcessedOccurrence[];
};

export type TimetableImportProcessedRowsReport = {
  batchId: number;
  status: "PREVIEWED" | "COMMITTED";
  warnings: string[];
  rows: TimetableImportProcessedRow[];
};

// ============================================================================
// Conflict Detection and Resolution Types
// ============================================================================

export type ConflictResolutionAction = "FORCE_OVERWRITE" | "SKIP" | "ALTERNATIVE_ROOM";

export type DetectedConflict = {
  occurrenceId: number;
  rowId: number;
  rowIndex: number;
  courseCode: string;
  slot: string;
  classroom: string;
  roomId: number;
  roomName: string;
  buildingName: string;
  startAt: string;
  endAt: string;
  conflictingBooking: {
    id: number;
    roomId: number;
    startAt: string;
    endAt: string;
    source: string;
    sourceRef: string | null;
  };
};

export type ConflictResolutionDecision = {
  occurrenceId: number;
  action: ConflictResolutionAction;
  alternativeRoomId?: number;
};

export type ConflictDetectionReport = {
  batchId: number;
  status: "FROZEN" | "NO_CONFLICTS";
  totalOccurrences: number;
  conflictCount: number;
  conflicts: DetectedConflict[];
  frozenAt: string | null;
  frozenBy: {
    userId: number;
    userName: string;
  } | null;
};

export type CommitWithResolutionsReport = {
  batchId: number;
  status: "COMMITTED";
  totalOccurrences: number;
  createdBookings: number;
  skippedOccurrences: number;
  overwrittenBookings: number;
  alternativeRoomBookings: number;
  deletedConflictingBookings: number;
  warnings: string[];
  changes: {
    created: Array<{
      occurrenceId: number;
      bookingId: number;
      roomId: number;
      startAt: string;
      endAt: string;
    }>;
    deleted: Array<{
      bookingId: number;
      roomId: number;
      startAt: string;
      endAt: string;
      reason: string;
    }>;
    skipped: Array<{
      occurrenceId: number;
      reason: string;
    }>;
  };
};

export type CancelCommitResponse = {
  batchId: number;
  status: "CANCELLED";
};

export type FreezeStatusResponse = {
  batchId: number;
  isFrozen: boolean;
  frozenByThisBatch: boolean;
  freezeInfo: {
    batchId: number;
    userId: number;
    userName: string;
    startedAt: string;
  } | null;
};

export type BookingFreezeErrorResponse = {
  error: string;
  message: string;
  freezeInfo: {
    batchId: number;
    frozenBy: string;
    startedAt: string;
  };
};

// ============================================================================

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  authProvider?: string;
};

export type RefreshTokenResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export type TimetableImportBatchListResponse = {
  data: TimetableImportBatchSummary[];
};

export type DashboardStats = {
  totalBookingsThisMonth: number;
  pendingRequests: number;
  roomUtilization: number;
  activeUsers: number;
};

export type UpcomingBooking = {
  id: number;
  roomId: number;
  roomName: string | null;
  startAt: string;
  endAt: string;
  source: string;
  requestId: number | null;
};

export type ActivityItem = {
  id: number;
  type: string;
  status: string;
  userId: number | null;
  userName: string | null;
  roomId: number;
  roomName: string | null;
  startAt: string;
  createdAt: string;
  eventType: string;
};

export type DashboardData = {
  stats: DashboardStats;
  upcomingBookings: UpcomingBooking[];
  activities: ActivityItem[];
};
