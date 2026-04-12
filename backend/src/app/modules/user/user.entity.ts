import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { Batch } from "../batch/batch.entity";

export enum UserRole {
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
  CR = "cr",
}
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  user_id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({
    default: UserRole.STUDENT,
    type: "enum",
    enum: Object.values(UserRole),
  })
  role!: UserRole;

  @Column()
  name!: string;

  @ManyToOne(() => Batch, { nullable: true })
  batch?: Batch;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
