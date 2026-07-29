import type { FastifyInstance } from "fastify";
import { loginRoute } from "./routes/auth/login-route";
import { confirmEventByUserRoute } from "./routes/calendar/confirm-event-by-user";
import { declinedEventByUserRoute } from "./routes/calendar/declined-event-by-user";
import { getAvailabilityUserRoute } from "./routes/calendar/get-availability-user-route";
import { getEventsByWaitingConfirmRoute } from "./routes/calendar/get-events-by-waiting-confirm-route";
import { getCalendarRoute } from "./routes/calendar/get-events-route";
import { getEventsSummaryRoute } from "./routes/calendar/get-events-summary-route";
import { getNextEventsRoute } from "./routes/calendar/get-nexts-events-route";
import { getPresenceUserRoute } from "./routes/calendar/get-presence-user-route";
import { createDocumentRoute } from "./routes/documents/create-document-route";
import { deleteDocumentRoute } from "./routes/documents/delete-document-route";
import { getDocumentsRoute } from "./routes/documents/fetch-documents-route";
import { getSummaryDocumentsRoute } from "./routes/documents/get-summary-documents-route";
import { updateDocumentRoute } from "./routes/documents/update-document-route";
import { getProblemsRoute } from "./routes/get-problems";
import { getProblemsDetailsRoute } from "./routes/get-problems-details";
import { getProblemsTimelineRoute } from "./routes/get-problems-timeline";
import { getServersRoute } from "./routes/get-servers";
import { ipsRoute } from "./routes/ips-route";
import { getAccessServerRoute } from "./routes/servers/dashboard/get-access-server-route";
import { createPrivilegeRoute } from "./routes/servers/users-privileges/create-privilege-route";
import { getUsersPrivilegesRoute } from "./routes/servers/users-privileges/get-users-privileges-route";
import { changePasswordMeRoute } from "./routes/users/change-password-me-route";
import { createUserRoute } from "./routes/users/create-user-route";
import { getSummaryTicketsRoute } from "./routes/users/get-summary-tickets-route";
import { getVPNDetailsRoute } from "./routes/users/get-vpn-details-route";
import { updateMeRoute } from "./routes/users/update-me-route";
import { getSummaryJira } from "./routes/jira/get-summary-user";
import { fetchProfilesRoute } from "./routes/profile/fetch-profiles-route";
import { getProfileByIdRoute } from "./routes/profile/get-profile-by-id";
import { getPermissionsRoute } from "./routes/profile/get-permissions-route";
import { createProfileRoute } from "./routes/profile/create-profile-route";
import { updateProfileRoute } from "./routes/profile/update-profile-route";
import { getProfilesSelect } from "./routes/profile/get-profiles-select";
import { createDocumentEventRoute } from "./routes/documents/create-document-event-route";
import { documentMetricsRoute } from "./routes/documents/documents-metrics-route";
import { getBackupsRoute } from "./routes/backups/get-backups-route";
import { startBackupRoute } from "./routes/backups/start-backup-nas-route";
import { startBackupExecutionRoute } from "./routes/backups/start-backup-execution-route";
import { createEventBackupExecutionRoute } from "./routes/backups/create-event-backup-execution-route";
import { getDataMaskingRoute } from "./routes/data-masking/get-data-masking-route";
import { createMaskingRoute } from "./routes/data-masking/create-masking-route";
import { getSummaryMaskingsRoute } from "./routes/data-masking/get-summary-maskings-route";
import { fetchMaskingRoute } from "./routes/data-masking/fetch-masking-route";

export const routes = async (app: FastifyInstance) => {
	app.register(createUserRoute);
	app.register(updateMeRoute);
	app.register(changePasswordMeRoute);
	app.register(getVPNDetailsRoute);
	app.register(getSummaryTicketsRoute);

	app.register(loginRoute);

	app.register(getSummaryJira);

	app.register(getAvailabilityUserRoute);
	app.register(getCalendarRoute);
	app.register(getPresenceUserRoute);
	app.register(getEventsSummaryRoute);
	app.register(getEventsByWaitingConfirmRoute);
	app.register(confirmEventByUserRoute);
	app.register(declinedEventByUserRoute);
	app.register(getNextEventsRoute);

	app.register(createDocumentRoute)
	app.register(updateDocumentRoute)
	app.register(getDocumentsRoute)
	app.register(deleteDocumentRoute)
	app.register(getSummaryDocumentsRoute)
	app.register(createDocumentEventRoute)
	app.register(documentMetricsRoute)

	app.register(fetchProfilesRoute)
	app.register(getProfileByIdRoute)
	app.register(getPermissionsRoute)
	app.register(createProfileRoute)
	app.register(updateProfileRoute)
	app.register(getProfilesSelect)

	app.register(ipsRoute);

	app.register(getServersRoute);
	app.register(getProblemsRoute);
	app.register(getProblemsTimelineRoute);
	app.register(getProblemsDetailsRoute);
	app.register(getUsersPrivilegesRoute);
	app.register(createPrivilegeRoute);
	app.register(getAccessServerRoute);

	app.register(getBackupsRoute)
	app.register(startBackupRoute)
	app.register(startBackupExecutionRoute)
	app.register(createEventBackupExecutionRoute)

	app.register(getDataMaskingRoute)
	app.register(createMaskingRoute)
	app.register(getSummaryMaskingsRoute)
	app.register(fetchMaskingRoute)
};
