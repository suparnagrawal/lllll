import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
  updateManagedUserActiveStatus,
  updateManagedUserRole,
} from "../api/api";
import type {
  AssignableUserRole,
  ManagedUser,
  UserRole,
} from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { formatDateDDMMYYYY } from "../utils/datetime";

type RoleFilter = "ALL" | UserRole;
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

const PAGE_SIZE = 20;

const ROLE_FILTER_OPTIONS: RoleFilter[] = [
  "ALL",
  "ADMIN",
  "STAFF",
  "FACULTY",
  "STUDENT",
  "PENDING_ROLE",
];

const ASSIGNABLE_ROLE_OPTIONS: AssignableUserRole[] = [
  "ADMIN",
  "STAFF",
  "FACULTY",
  "STUDENT",
];

const ADMIN_CREATE_ROLE_OPTIONS: Array<"ADMIN" | "STAFF"> = ["ADMIN", "STAFF"];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  FACULTY: "Faculty",
  STUDENT: "Student",
  PENDING_ROLE: "Pending Role",
};

function getUserDisplayName(user: ManagedUser): string {
  const displayName = user.displayName?.trim();
  return displayName && displayName.length > 0 ? displayName : user.name;
}

function isAssignableRole(role: UserRole): role is AssignableUserRole {
  return role !== "PENDING_ROLE";
}

function roleBadgeClass(role: UserRole): string {
  if (role === "ADMIN") return "badge badge--danger";
  if (role === "STAFF") return "badge badge--info";
  if (role === "FACULTY") return "badge badge--warning";
  if (role === "STUDENT") return "badge badge--success";
  return "badge badge--muted";
}

export function UsersPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [newDepartment, setNewDepartment] = useState("");

  const [creatingUser, setCreatingUser] = useState(false);
  const [actingRoleUserId, setActingRoleUserId] = useState<number | null>(null);
  const [actingActiveUserId, setActingActiveUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<number, AssignableUserRole>>({});

  const loadUsers = async (
    targetPage = 1,
    overrides?: Partial<{
      search: string;
      department: string;
      roleFilter: RoleFilter;
      activeFilter: ActiveFilter;
    }>,
  ) => {
    const resolvedSearch = (overrides?.search ?? search).trim();
    const resolvedDepartment = (overrides?.department ?? department).trim();
    const resolvedRoleFilter = overrides?.roleFilter ?? roleFilter;
    const resolvedActiveFilter = overrides?.activeFilter ?? activeFilter;

    setLoading(true);
    setError(null);

    try {
      const response = await getManagedUsers({
        page: targetPage,
        limit: PAGE_SIZE,
        ...(resolvedRoleFilter !== "ALL" ? { role: resolvedRoleFilter } : {}),
        ...(resolvedDepartment ? { department: resolvedDepartment } : {}),
        ...(resolvedSearch ? { search: resolvedSearch } : {}),
        ...(resolvedActiveFilter === "ACTIVE"
          ? { isActive: true }
          : resolvedActiveFilter === "INACTIVE"
            ? { isActive: false }
            : {}),
      });

      setRows(response.data);
      setPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotalUsers(response.pagination.total);

      setRoleDraftByUserId((previousDrafts) => {
        const nextDrafts = { ...previousDrafts };

        for (const managedUser of response.data) {
          if (nextDrafts[managedUser.id]) {
            continue;
          }

          if (isAssignableRole(managedUser.role)) {
            nextDrafts[managedUser.id] = managedUser.role;
          } else {
            nextDrafts[managedUser.id] = "STUDENT";
          }
        }

        return nextDrafts;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      return;
    }

    void loadUsers(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <section>
        <div className="page-header">
          <h2>User Management</h2>
          <p>Admin access required.</p>
        </div>
        <div className="alert alert-error">You do not have permission to access this page.</div>
      </section>
    );
  }

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadUsers(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDepartment("");
    setRoleFilter("ALL");
    setActiveFilter("ALL");
    void loadUsers(1, {
      search: "",
      department: "",
      roleFilter: "ALL",
      activeFilter: "ALL",
    });
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedDepartment = newDepartment.trim();

    if (!trimmedName || !trimmedEmail || !newPassword) {
      setError("Name, email and password are required");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setCreatingUser(true);
    setError(null);
    setNotice(null);

    try {
      await createManagedUser({
        name: trimmedName,
        email: trimmedEmail,
        password: newPassword,
        role: newRole,
        ...(trimmedDepartment ? { department: trimmedDepartment } : {}),
      });

      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewDepartment("");
      setNewRole("STAFF");
      setNotice("User created successfully.");
      await loadUsers(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateRole = async (targetUser: ManagedUser) => {
    const selectedRole = roleDraftByUserId[targetUser.id] ??
      (isAssignableRole(targetUser.role) ? targetUser.role : "STUDENT");

    if (isAssignableRole(targetUser.role) && selectedRole === targetUser.role) {
      return;
    }

    setActingRoleUserId(targetUser.id);
    setError(null);
    setNotice(null);

    try {
      await updateManagedUserRole(targetUser.id, selectedRole);
      setNotice(`Role updated for ${getUserDisplayName(targetUser)}.`);
      await loadUsers(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActingRoleUserId(null);
    }
  };

  const handleToggleActive = async (targetUser: ManagedUser) => {
    const nextIsActive = !targetUser.isActive;
    setActingActiveUserId(targetUser.id);
    setError(null);
    setNotice(null);

    try {
      await updateManagedUserActiveStatus(targetUser.id, nextIsActive);
      setNotice(`${getUserDisplayName(targetUser)} is now ${nextIsActive ? "active" : "inactive"}.`);
      await loadUsers(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update active status");
    } finally {
      setActingActiveUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser: ManagedUser) => {
    const confirmed = window.confirm(
      `Delete ${getUserDisplayName(targetUser)}? This will anonymize and deactivate the account.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(targetUser.id);
    setError(null);
    setNotice(null);

    try {
      await deleteManagedUser(targetUser.id);
      setNotice(`Deleted ${getUserDisplayName(targetUser)}.`);

      const nextPage = page > 1 && rows.length === 1 ? page - 1 : page;
      await loadUsers(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <section>
      <div className="page-header">
        <h2>User Management</h2>
        <p>Track users, transfer roles, control account status, and manage staff/admin access.</p>
      </div>

      <form className="card section-gap" onSubmit={handleCreateUser}>
        <div className="card-header">
          <h3>Create Admin/Staff Account</h3>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="newManagedUserName">Full Name</label>
            <input
              id="newManagedUserName"
              className="input"
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Aarav Sharma"
              disabled={creatingUser}
            />
          </div>

          <div className="form-field">
            <label htmlFor="newManagedUserEmail">Email</label>
            <input
              id="newManagedUserEmail"
              className="input"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="user@iitj.ac.in"
              disabled={creatingUser}
            />
          </div>

          <div className="form-field">
            <label htmlFor="newManagedUserPassword">Temporary Password</label>
            <input
              id="newManagedUserPassword"
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              disabled={creatingUser}
            />
          </div>

          <div className="form-field">
            <label htmlFor="newManagedUserRole">Role</label>
            <select
              id="newManagedUserRole"
              className="input"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as "ADMIN" | "STAFF")}
              disabled={creatingUser}
            >
              {ADMIN_CREATE_ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {ROLE_LABELS[roleOption]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="newManagedUserDepartment">Department (Optional)</label>
            <input
              id="newManagedUserDepartment"
              className="input"
              type="text"
              value={newDepartment}
              onChange={(event) => setNewDepartment(event.target.value)}
              placeholder="Computer Science"
              disabled={creatingUser}
            />
          </div>
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary" disabled={creatingUser}>
            {creatingUser ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>

      <form className="card section-gap" onSubmit={handleApplyFilters}>
        <div className="card-header">
          <h3>Directory Filters</h3>
          <span className="badge badge--info">{totalUsers} users</span>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="usersSearch">Search</label>
            <input
              id="usersSearch"
              className="input"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="usersDepartment">Department</label>
            <input
              id="usersDepartment"
              className="input"
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Department"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="usersRoleFilter">Role</label>
            <select
              id="usersRoleFilter"
              className="input"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              disabled={loading}
            >
              {ROLE_FILTER_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleOption === "ALL" ? "All Roles" : ROLE_LABELS[roleOption]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="usersActiveFilter">Status</label>
            <select
              id="usersActiveFilter"
              className="input"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
              disabled={loading}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            Apply Filters
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </form>

      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card users-management-card">
        <div className="card-header">
          <h3>User Directory</h3>
          <span className="users-page-count">Page {page} of {Math.max(totalPages, 1)}</span>
        </div>

        {loading && <p className="loading-text">Loading users...</p>}
        {!loading && rows.length === 0 && <p className="empty-text">No users found for the selected filters.</p>}

        {!loading && rows.length > 0 && (
          <>
            <div className="users-table-wrap">
              <table className="users-admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Auth</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((managedUser) => {
                    const selectedRole = roleDraftByUserId[managedUser.id] ??
                      (isAssignableRole(managedUser.role) ? managedUser.role : "STUDENT");
                    const isRoleActing = actingRoleUserId === managedUser.id;
                    const isActiveActing = actingActiveUserId === managedUser.id;
                    const isDeleting = deletingUserId === managedUser.id;

                    return (
                      <tr key={managedUser.id}>
                        <td>
                          <div className="users-name-cell">
                            <span className="users-name">{getUserDisplayName(managedUser)}</span>
                            <span className="users-email">{managedUser.email}</span>
                          </div>
                        </td>

                        <td>
                          <div className="users-role-cell">
                            <span className={roleBadgeClass(managedUser.role)}>
                              {ROLE_LABELS[managedUser.role]}
                            </span>
                            <div className="users-role-editor">
                              <select
                                className="input"
                                value={selectedRole}
                                onChange={(event) => {
                                  const updatedRole = event.target.value as AssignableUserRole;
                                  setRoleDraftByUserId((previousDrafts) => ({
                                    ...previousDrafts,
                                    [managedUser.id]: updatedRole,
                                  }));
                                }}
                                disabled={isRoleActing || isDeleting}
                              >
                                {ASSIGNABLE_ROLE_OPTIONS.map((roleOption) => (
                                  <option key={roleOption} value={roleOption}>
                                    {ROLE_LABELS[roleOption]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={isRoleActing || isDeleting}
                                onClick={() => void handleUpdateRole(managedUser)}
                              >
                                {isRoleActing ? "Updating..." : "Transfer"}
                              </button>
                            </div>
                          </div>
                        </td>

                        <td>{managedUser.department ?? "-"}</td>
                        <td>{managedUser.registeredVia}</td>

                        <td>
                          <div className="users-status-stack">
                            <span className={managedUser.isActive ? "badge badge--success" : "badge badge--muted"}>
                              {managedUser.isActive ? "Active" : "Inactive"}
                            </span>
                            {managedUser.firstLogin && <span className="users-muted">First login pending</span>}
                          </div>
                        </td>

                        <td>{formatDateDDMMYYYY(managedUser.createdAt)}</td>

                        <td>
                          <div className="users-actions">
                            <button
                              type="button"
                              className={`btn btn-sm ${managedUser.isActive ? "btn-ghost" : "btn-success"}`}
                              disabled={isActiveActing || isDeleting}
                              onClick={() => void handleToggleActive(managedUser)}
                            >
                              {isActiveActing
                                ? "Saving..."
                                : managedUser.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isDeleting || isRoleActing || isActiveActing}
                              onClick={() => void handleDeleteUser(managedUser)}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="users-pagination">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1 || loading}
                  onClick={() => void loadUsers(page - 1)}
                >
                  Previous
                </button>

                <span className="users-page-count">Page {page} of {Math.max(totalPages, 1)}</span>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => void loadUsers(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
