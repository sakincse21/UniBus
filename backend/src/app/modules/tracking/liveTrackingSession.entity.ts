import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { Bus } from "../bus/bus.entity";
import { User } from "../user/user.entity";

@Entity("live_tracking_sessions")
export class LiveTrackingSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Bus)
  bus!: Bus;

  @ManyToOne(() => User)
  user!: User;

  @Column()
  startedAt!: Date;

  @Column()
  expiresAt!: Date;

  @Column({ default: true })
  active!: boolean;
}
