import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { DateInput } from "../../DateInput";
import { useCreateBookingRequest } from "../../../hooks/useBookingRequests";
import { getAvailability } from "../../../lib/api/availability";
import type {
  BookingEventType,
  AvailabilityBuilding,
} from "../../../lib/api/types";

const bookingRequestSchema = z.object({
  title: z.string().min(1, "Event title is required").max(100),
  eventType: z.enum([
    "QUIZ",
    "SEMINAR",
    "SPEAKER_SESSION",
    "MEETING",
    "CULTURAL_EVENT",
    "WORKSHOP",
    "CLASS",
    "OTHER",
  ]),
  participantCount: z.coerce
    .number()
    .int()
    .positive("Participant count must be greater than 0")
    .optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  roomId: z.coerce.number().int().positive("Room selection is required"),
});

type BookingRequestFormData = z.infer<typeof bookingRequestSchema>;

const EVENT_TYPES: BookingEventType[] = [
  "QUIZ",
  "SEMINAR",
  "SPEAKER_SESSION",
  "MEETING",
  "CULTURAL_EVENT",
  "WORKSHOP",
  "CLASS",
  "OTHER",
];

interface BookingRequestWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPushToast: (type: "success" | "error" | "info" | "warning", message: string) => void;
  onSuccess?: () => void;
}

export function BookingRequestWizard({
  open,
  onOpenChange,
  onPushToast,
  onSuccess,
}: BookingRequestWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [availableRooms, setAvailableRooms] = useState<AvailabilityBuilding[]>(
    []
  );
  const [loadingRooms, setLoadingRooms] = useState(false);

  const createBookingMutation = useCreateBookingRequest();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<BookingRequestFormData>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      title: "",
      eventType: "OTHER",
      participantCount: undefined,
      date: "",
      startTime: "",
      endTime: "",
      roomId: 0,
    },
  });

  const date = watch("date");
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const selectedRoomId = watch("roomId");

  // Fetch available rooms when date/time changes
  useEffect(() => {
    if (!date || !startTime || !endTime) return;

    const fetchAvailableRooms = async () => {
      try {
        setLoadingRooms(true);
        const dateObj = new Date(date);
        const [startHour, startMin] = startTime.split(":").map(Number);
        const [endHour, endMin] = endTime.split(":").map(Number);

        const startAt = new Date(dateObj);
        startAt.setHours(startHour, startMin, 0, 0);

        const endAtDate = new Date(dateObj);
        endAtDate.setHours(endHour, endMin, 0, 0);

        const availability = await getAvailability(
          startAt.toISOString(),
          endAtDate.toISOString()
        );

        setAvailableRooms(availability);
      } catch (err) {
        onPushToast(
          "error",
          err instanceof Error ? err.message : "Failed to fetch available rooms"
        );
        setAvailableRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchAvailableRooms();
  }, [date, startTime, endTime, onPushToast]);

  const handleNext = async () => {
    if (currentStep === 2) {
      await handleSubmit(() => {}, async (errors) => {
        if (errors.date || errors.startTime || errors.endTime) {
          onPushToast("error", "Please fill in all date and time fields");
        }
      })();
    } else if (currentStep === 3) {
      if (!selectedRoomId) {
        onPushToast("error", "Please select a room");
        return;
      }
    } else if (currentStep === 1) {
      await handleSubmit(() => {}, async (errors) => {
        if (errors.title || errors.eventType) {
          onPushToast("error", "Please fill in all required fields");
        }
      })();
    }

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
  };

  const onSubmit = async (data: BookingRequestFormData) => {
    try {
      const dateObj = new Date(data.date);
      const [startHour, startMin] = data.startTime.split(":").map(Number);
      const [endHour, endMin] = data.endTime.split(":").map(Number);

      const startAt = new Date(dateObj);
      startAt.setHours(startHour, startMin, 0, 0);

      const endAtDate = new Date(dateObj);
      endAtDate.setHours(endHour, endMin, 0, 0);

      await createBookingMutation.mutateAsync({
        roomId: data.roomId,
        startAt: startAt.toISOString(),
        endAt: endAtDate.toISOString(),
        eventType: data.eventType,
        purpose: data.title,
        participantCount: data.participantCount,
      });

      onPushToast("success", "Booking request created successfully");
      reset();
      setCurrentStep(1);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      onPushToast(
        "error",
        err instanceof Error ? err.message : "Failed to create booking request"
      );
    }
  };

  const handleClose = () => {
    reset();
    setCurrentStep(1);
    onOpenChange(false);
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1:
        return "Event Details";
      case 2:
        return "Date & Time";
      case 3:
        return "Room Selection";
      case 4:
        return "Review & Submit";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Step {currentStep} of 4: {getStepTitle(currentStep)}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1 &&
              "Provide the event title, type, and expected participant count"}
            {currentStep === 2 && "Select the date and time for your booking"}
            {currentStep === 3 &&
              "Choose an available room based on your selected date and time"}
            {currentStep === 4 && "Review your booking request details"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Event Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., CS101 Midterm Exam"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type *</Label>
                <select
                  id="eventType"
                  {...register("eventType")}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.eventType && (
                  <p className="text-sm text-red-500">
                    {errors.eventType.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="participantCount">Participant Count</Label>
                <Input
                  id="participantCount"
                  type="number"
                  placeholder="e.g., 30"
                  {...register("participantCount")}
                />
                {errors.participantCount && (
                  <p className="text-sm text-red-500">
                    {errors.participantCount.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <DateInput
                  value={date}
                  onChange={(value) => setValue("date", value)}
                  mode="date"
                />
                {errors.date && (
                  <p className="text-sm text-red-500">{errors.date.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    {...register("startTime")}
                  />
                  {errors.startTime && (
                    <p className="text-sm text-red-500">
                      {errors.startTime.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input id="endTime" type="time" {...register("endTime")} />
                  {errors.endTime && (
                    <p className="text-sm text-red-500">
                      {errors.endTime.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Room Selection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {loadingRooms ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-gray-500">Loading available rooms...</p>
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-gray-500">
                    No available rooms for the selected date and time
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {availableRooms.map((building) => (
                    <div key={building.buildingId} className="space-y-2">
                      <h3 className="font-semibold text-sm">
                        {building.buildingName}
                      </h3>
                      <div className="space-y-2 pl-4">
                        {building.rooms.map((room) => (
                          <label
                            key={room.id}
                            className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedRoomId === room.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:bg-gray-50"
                            } ${!room.isAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="radio"
                              name="roomId"
                              value={room.id}
                              checked={selectedRoomId === room.id}
                              onChange={(e) =>
                                setValue("roomId", parseInt(e.target.value, 10))
                              }
                              disabled={!room.isAvailable}
                              className="cursor-pointer"
                            />
                            <div>
                              <p className="font-medium text-sm">{building.buildingName} - {room.name}</p>
                              {!room.isAvailable && (
                                <p className="text-xs text-red-500">
                                  Not available
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.roomId && (
                <p className="text-sm text-red-500">{errors.roomId.message}</p>
              )}
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {/* Event Details */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                    Event Details
                    <button
                      type="button"
                      onClick={() => handleEditStep(1)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-normal"
                    >
                      Edit
                    </button>
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Title:</span>{" "}
                      {getValues("title")}
                    </p>
                    <p>
                      <span className="font-medium">Type:</span>{" "}
                      {getValues("eventType")}
                    </p>
                    {getValues("participantCount") && (
                      <p>
                        <span className="font-medium">Participants:</span>{" "}
                        {getValues("participantCount")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Date & Time */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                    Date & Time
                    <button
                      type="button"
                      onClick={() => handleEditStep(2)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-normal"
                    >
                      Edit
                    </button>
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Date:</span>{" "}
                      {new Date(getValues("date")).toLocaleDateString()}
                    </p>
                    <p>
                      <span className="font-medium">Time:</span>{" "}
                      {getValues("startTime")} - {getValues("endTime")}
                    </p>
                  </div>
                </div>

                {/* Room Selection */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
                    Selected Room
                    <button
                      type="button"
                      onClick={() => handleEditStep(3)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-normal"
                    >
                      Edit
                    </button>
                  </h4>
                  <div className="space-y-1 text-sm">
                    {availableRooms.map((building) => {
                      const selectedRoom = building.rooms.find(
                        (r) => r.id === getValues("roomId")
                      );
                      if (selectedRoom) {
                        return (
                          <div key={building.buildingId}>
                            <p>
                              <span className="font-medium">Room:</span>{" "}
                              {selectedRoom.name}
                            </p>
                            <p>
                              <span className="font-medium">Building:</span>{" "}
                              {building.buildingName}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep < 4 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createBookingMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit(onSubmit)}
                  disabled={createBookingMutation.isPending}
                >
                  {createBookingMutation.isPending
                    ? "Submitting..."
                    : "Submit Request"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
