import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useSystemQoLPreferences } from "../hooks/useSystemQoLPreferences";
import {
  DEFAULT_SYSTEM_QOL_PREFERENCES,
  type SystemQoLPreferences,
} from "../lib/systemQol";
import type { SystemQoLSectionKey } from "../lib/api";
import { formatError } from "../utils/formatError";

const SECTION_OPTIONS: Array<{
  key: SystemQoLSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Load dashboard cards and activity data automatically.",
  },
  {
    key: "bookings",
    label: "Bookings",
    description: "Auto-load full booking history. When disabled in manual mode, users see a recent preview first.",
  },
  {
    key: "rooms",
    label: "Rooms",
    description: "Load buildings/rooms management data automatically.",
  },
  {
    key: "availability",
    label: "Availability",
    description: "Load availability buildings and rooms automatically.",
  },
  {
    key: "bookingRequests",
    label: "Booking Requests",
    description: "Auto-load full booking request history. When disabled in manual mode, users see recent requests first.",
  },
  {
    key: "users",
    label: "Users",
    description: "Load user management data automatically.",
  },
];

function clonePreferences(preferences: SystemQoLPreferences): SystemQoLPreferences {
  return {
    manualDataLoading: preferences.manualDataLoading,
    autoLoadDependentData: preferences.autoLoadDependentData,
    autoLoadSections: {
      ...preferences.autoLoadSections,
    },
  };
}

export default function SystemLoadingSettingsPage() {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoading,
    isSaving,
    error,
  } = useSystemQoLPreferences();

  const [draft, setDraft] = useState<SystemQoLPreferences>(() =>
    clonePreferences(preferences),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(clonePreferences(preferences));
  }, [
    preferences.autoLoadDependentData,
    preferences.manualDataLoading,
    preferences.autoLoadSections.dashboard,
    preferences.autoLoadSections.bookings,
    preferences.autoLoadSections.rooms,
    preferences.autoLoadSections.availability,
    preferences.autoLoadSections.bookingRequests,
    preferences.autoLoadSections.users,
  ]);

  const isDirty = useMemo(
    () => {
      if (draft.manualDataLoading !== preferences.manualDataLoading) {
        return true;
      }

      if (draft.autoLoadDependentData !== preferences.autoLoadDependentData) {
        return true;
      }

      return SECTION_OPTIONS.some(
        ({ key }) =>
          draft.autoLoadSections[key] !== preferences.autoLoadSections[key],
      );
    },
    [
      draft.autoLoadDependentData,
      draft.autoLoadSections,
      draft.manualDataLoading,
      preferences.autoLoadDependentData,
      preferences.autoLoadSections,
      preferences.manualDataLoading,
    ],
  );

  const handleSave = async () => {
    setSubmitError(null);
    setNotice(null);

    try {
      await updatePreferences(draft);
      setNotice("Global loading settings saved. Changes now apply to all users.");
    } catch (saveError) {
      setSubmitError(formatError(saveError, "Failed to save system settings"));
    }
  };

  const handleResetDefaults = async () => {
    setSubmitError(null);
    setNotice(null);

    try {
      await resetPreferences();
      setDraft(clonePreferences(DEFAULT_SYSTEM_QOL_PREFERENCES));
      setNotice("Global loading settings reset to defaults for all users.");
    } catch (resetError) {
      setSubmitError(
        formatError(resetError, "Failed to reset system settings"),
      );
    }
  };

  return (
    <section className="space-y-6">
      <div className="page-header">
        <h2>System Loading Settings</h2>
        <p>
          Configure manual and automatic data loading globally. These settings
          apply to every user across the system.
        </p>
      </div>

      {error && <div className="alert alert-error">{formatError(error)}</div>}
      {submitError && <div className="alert alert-error">{submitError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Global Loading Controls</CardTitle>
          <CardDescription>
              Manual mode keeps initial loads lightweight by showing recent data and
              deferring full history until users request it.
            Section toggles below let admins choose exactly which pages auto-load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={draft.manualDataLoading}
              disabled={isLoading || isSaving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  manualDataLoading: event.target.checked,
                }))
              }
            />
            <span>
              Enable manual data loading for heavy pages (recommended to reduce
              unnecessary API traffic).
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={draft.autoLoadDependentData}
              disabled={isLoading || isSaving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  autoLoadDependentData: event.target.checked,
                }))
              }
            />
            <span>
              Auto-load dependent datasets after a user makes primary
              selections.
            </span>
          </label>

          <div className="pt-2">
            <p className="text-sm font-medium mb-2">Auto-load by page/module</p>
            <div className="space-y-3">
              {SECTION_OPTIONS.map((section) => (
                <label key={section.key} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded"
                    checked={draft.autoLoadSections[section.key]}
                    disabled={isLoading || isSaving}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        autoLoadSections: {
                          ...current.autoLoadSections,
                          [section.key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium">{section.label}</span>
                    <span className="block text-muted-foreground">
                      {section.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving || !isDirty}
            >
              {isSaving ? "Saving..." : "Save Global Settings"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefaults}
              disabled={isLoading || isSaving}
            >
              Reset To Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
