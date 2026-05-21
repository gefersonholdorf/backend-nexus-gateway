import { env } from "./env";
import { app } from "./index";

const port = env.PORT;

app.listen({ port }, (err) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
});