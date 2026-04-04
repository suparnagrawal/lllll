// Constants
export { API_BASE_URL, AUTH_TOKEN_KEY, AUTH_USER_KEY } from "./constants";

// Types
export type {
  UserRole,
  SetupRole,
  AuthUser,
  AssignableUserRole,
  FacultyUser,
  ManagedUser,
  ManagedUsersPagination,
  ManagedUsersListResponse,
  StaffBuildingAssignmentsResponse,
  Building,
  Room,
  BookingStatus,
  BookingEventType,
  BookingSource,
  BookingRequest,
  Booking,
  NotificationType,
  AppNotification,
  NotificationsResponse,
  BookingPruneScope,
  BookingPruneResult,
  AvailabilityRoom,
  AvailabilityBuilding,
  DayOfWeek,
  SlotSystem,
  SlotDay,
  SlotTimeBand,
  SlotBlock,
  SlotFullGrid,
  TimetableImportRowStatus,
  TimetableImportPreviewRow,
  TimetableImportPreviewReport,
  TimetableImportSavedDecision,
  TimetableImportBatchSummary,
  TimetableImportDecisionSaveReport,
  TimetableImportBatchDeleteReport,
  TimetableImportTransferRowReport,
  TimetableImportCreateSlotDecision,
  TimetableImportCreateRoomDecision,
  TimetableImportCommitDecision,
  TimetableImportCommitRowResult,
  TimetableImportConflictingBooking,
  TimetableImportCommitReport,
  TimetableImportProcessedOccurrenceStatus,
  TimetableImportProcessedOccurrence,
  TimetableImportProcessedRow,
  TimetableImportProcessedRowsReport,
  LoginResponse,
  ApiErrorPayload,
  BuildingsListResponse,
  TimetableImportBatchListResponse,
  DashboardStats,
  UpcomingBooking,
  ActivityItem,
} from "./types";

// Client utilities
export {
  setOnUnauthorized,
  getAuthToken,
  getAuthUser,
  clearAuth,
  setAuthSession,
  request,
  requestFormData,
  httpErrorMessage,
} from "./client";

// Auth endpoints
export {
  login,
  startGoogleOAuthLogin,
  loginWithOAuthToken,
  completeOAuthSetup,
} from "./auth";

// Buildings endpoints
export {
  getBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "./buildings";

// Rooms endpoints
export {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability,
} from "./rooms";

// Users endpoints
export {
  getFacultyUsers,
  getManagedUsers,
  createManagedUser,
  updateManagedUserRole,
  updateManagedUserActiveStatus,
  deleteManagedUser,
  getUserBuildingAssignments,
  updateUserBuildingAssignments,
} from "./users";

// Booking requests endpoints
export {
  getBookingRequests,
  createBookingRequest,
  approveBookingRequest,
  forwardBookingRequest,
  rejectBookingRequest,
  cancelBookingRequest,
} from "./booking-requests";

// Notifications endpoints
export {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications";

// Bookings endpoints
export {
  getBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  pruneAllBookings,
  pruneBookingsBySlotSystem,
} from "./bookings";

// Availability endpoints
export {
  getAvailability,
} from "./availability";

// Dashboard endpoints
export {
  getDashboardStats,
  getUpcomingBookings,
  getActivityFeed,
} from "./dashboard";

// Slot system and Timetable import endpoints
export {
  getSlotSystems,
  createSlotSystem,
  deleteSlotSystem,
  getDays,
  createDay,
  deleteDay,
  addDayLane,
  removeDayLane,
  getTimeBands,
  createTimeBand,
  updateTimeBand,
  deleteTimeBand,
  getFullGrid,
  createBlock,
  deleteBlock,
  getTimetableImportBatches,
  getTimetableImportBatch,
  saveTimetableImportDecisions,
  transferTimetableImportRow,
  previewTimetableImport,
  commitTimetableImport,
  reallocateTimetableImport,
  deleteTimetableImportBatch,
  getTimetableImportProcessedRows,
} from "./slots";
