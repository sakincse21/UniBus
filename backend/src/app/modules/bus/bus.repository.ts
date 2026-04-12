import { AppDataSource } from "../../db/data-source";
import { Bus } from "./bus.entity";

const busRepo = AppDataSource.getRepository(Bus);
export default busRepo;
