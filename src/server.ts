import { env } from "./env";
import { app } from "./index";
import { startBackupSyncWorker } from "./workers/backup-sync.worker";

const port = env.PORT;

startBackupSyncWorker();

app.listen({ port, host: "0.0.0.0" }, (err) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`Nexus Gateway API is running at port ${port}`);
});
