import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BuildingsPage } from "./pages/Buildings.tsx";
import { RoomsPage } from "./pages/Rooms.tsx";
import { BookingRequestsPage } from "./pages/BookingRequests.tsx";
import { clearAuth, getAuthUser, login } from "./api/api";

type PageKey = "buildings" | "rooms" | "bookingRequests";

function App() {
	const [activePage, setActivePage] = useState<PageKey>("buildings");
	const [user, setUser] = useState(() => getAuthUser());
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [authError, setAuthError] = useState<string | null>(null);
	const [authLoading, setAuthLoading] = useState(false);

	const pageContent = useMemo(() => {
		if (activePage === "buildings") {
			return <BuildingsPage />;
		}

		if (activePage === "rooms") {
			return <RoomsPage />;
		}

		return <BookingRequestsPage />;
	}, [activePage]);

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const trimmedEmail = email.trim();
		if (!trimmedEmail || !password) {
			setAuthError("Email and password are required");
			return;
		}

		setAuthLoading(true);
		setAuthError(null);

		try {
			const loggedInUser = await login(trimmedEmail, password);
			setUser(loggedInUser);
			setPassword("");
		} catch (requestError) {
			const message = requestError instanceof Error ? requestError.message : "Login failed";
			setAuthError(message);
		} finally {
			setAuthLoading(false);
		}
	};

	if (!user) {
		return (
			<div className="app-shell">
				<header className="app-header">
					<h1>Unified Room Allocation &amp; Booking System</h1>
					<p>Primary System Only</p>
				</header>

				<form className="panel" onSubmit={handleLogin}>
					<h2>Login</h2>
					<label htmlFor="loginEmail">Email</label>
					<input
						id="loginEmail"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						disabled={authLoading}
					/>

					<label htmlFor="loginPassword">Password</label>
					<input
						id="loginPassword"
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						disabled={authLoading}
					/>

					<button type="submit" disabled={authLoading}>
						{authLoading ? "Signing in..." : "Login"}
					</button>
					{authError ? <p className="error">Error: {authError}</p> : null}
				</form>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<header className="app-header">
				<h1>Unified Room Allocation &amp; Booking System</h1>
				<p>Primary System Only</p>
				<p>
					Signed in as {user.name} ({user.role})
				</p>
				<button
					type="button"
					onClick={() => {
						clearAuth();
						setUser(null);
					}}
				>
					Logout
				</button>
			</header>

			<nav className="nav-tabs" aria-label="Primary navigation">
				<button
					type="button"
					className={activePage === "buildings" ? "active" : ""}
					onClick={() => setActivePage("buildings")}
				>
					Buildings
				</button>
				<button
					type="button"
					className={activePage === "rooms" ? "active" : ""}
					onClick={() => setActivePage("rooms")}
				>
					Rooms
				</button>
				<button
					type="button"
					className={activePage === "bookingRequests" ? "active" : ""}
					onClick={() => setActivePage("bookingRequests")}
				>
					Booking Requests
				</button>
			</nav>

			<main className="page-content">{pageContent}</main>
		</div>
	);
}

export default App;
