import { env } from "./env";
import { app } from "./index";

const port = env.PORT;

app.listen({ port }, (err) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	if (env.APP !== "production") {
		console.log(`Nexus Gateway API is running at port ${port}`);
	}
});
