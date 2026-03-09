import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";

export enum DayOfWeek {
  SATURDAY = "saturday",
  SUNDAY = "sunday",
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
}

@Entity("routines")
export class Routine {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ type: "enum", enum: DayOfWeek })
  day!: DayOfWeek;

  /** HH:mm format, e.g. "08:30" */
  @Column({ type: "varchar", length: 5 })
  firstHalfStart!: string;

  /** HH:mm format, e.g. "13:00" */
  @Column({ type: "varchar", length: 5 })
  secondHalfStart!: string;

  /** AI confidence score 0-1 */
  @Column({ type: "float", default: 1 })
  confidence!: number;

  /** Optional label, e.g. "Physics Lab" */
  @Column({ type: "varchar", length: 255, nullable: true })
  note?: string;

  /** Whether user has confirmed / edited this entry */
  @Column({ type: "boolean", default: false })
  confirmed!: boolean;

  /** Whether reminders are active for this entry */
  @Column({ type: "boolean", default: true })
  remindersEnabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
