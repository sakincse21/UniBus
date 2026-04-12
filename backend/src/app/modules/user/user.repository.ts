import { AppDataSource } from "../../db/data-source";
import { User } from "./user.entity";

const userRepo = AppDataSource.getRepository(User);

export default userRepo;