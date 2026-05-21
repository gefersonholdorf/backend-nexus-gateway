import { env } from "./env";
import { app } from "./index";

const port = env.PORT;

app.listen(
	{ 
		port,
		host: '0.0.0.0'
	}, (err) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
});