import type { FastifyInstance } from "fastify";
import { getProblemsRoute } from "./routes/get-problems";
import { getProblemsTimelineRoute } from "./routes/get-problems-timeline";
import { getProblemsDetailsRoute } from "./routes/get-problems-details";
import { getUsersPrivilegesRoute } from "./routes/servers/users-privileges/get-users-privileges-route";
import { createPrivilegeRoute } from "./routes/servers/users-privileges/create-privilege-route";
import { getAccessServerRoute } from "./routes/servers/dashboard/get-access-server-route";
import { getServersRoute } from "./routes/get-servers";
import { createUserRoute } from "./routes/users/create-user-route";
import { loginRoute } from "./routes/auth/login-route";
import { ipsRoute } from "./routes/ips-route";
import { updateMeRoute } from "./routes/users/update-me-route";
import { changePasswordMeRoute } from "./routes/users/change-password-me-route";
import { getVPNDetailsRoute } from "./routes/users/get-vpn-details-route";
import { getSummaryTicketsRoute } from "./routes/users/get-summary-tickets-route";
import { getPresenceUserRoute } from "./routes/calendar/get-presence-user-route";
import { getAvailabilityUserRoute } from "./routes/calendar/get-availability-user-route";
import { getCalendarRoute } from "./routes/calendar/get-events-route";
import { getEventsSummaryRoute } from "./routes/calendar/get-events-summary-route";
import { getEventsByWaitingConfirmRoute } from "./routes/calendar/get-events-by-waiting-confirm-route";
import { confirmEventByUserRoute } from "./routes/calendar/confirm-event-by-user";

export const routes = async (app: FastifyInstance) => {
	app.register(createUserRoute);
	app.register(updateMeRoute);
	app.register(changePasswordMeRoute);
	app.register(getVPNDetailsRoute);
	app.register(getSummaryTicketsRoute);

	app.register(loginRoute);

	app.register(getAvailabilityUserRoute);
	app.register(getCalendarRoute);
	app.register(getPresenceUserRoute);
	app.register(getEventsSummaryRoute);
	app.register(getEventsByWaitingConfirmRoute);
	app.register(confirmEventByUserRoute);

	app.register(ipsRoute);

	app.register(getServersRoute);
	app.register(getProblemsRoute);
	app.register(getProblemsTimelineRoute);
	app.register(getProblemsDetailsRoute);
	app.register(getUsersPrivilegesRoute);
	app.register(createPrivilegeRoute);
	app.register(getAccessServerRoute);
};
