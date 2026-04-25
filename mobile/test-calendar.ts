import { createConnection, ConnectionOptions } from "typeorm";
import { AppDataSource } from "./backend/src/app/db/data-source";
import { getCalendarEvents } from "./backend/src/app/modules/calendar/calendar.service";
AppDataSource.initialize().then(async () => {
    const events = await getCalendarEvents("2", 30); // student user
    console.log(JSON.stringify(events, null, 2));
    process.exit(0);
});
