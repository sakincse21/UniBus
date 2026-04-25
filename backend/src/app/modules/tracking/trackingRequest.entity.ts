import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../user/user.entity";

export enum TrackingRequestStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

@Entity("tracking_requests")
export class TrackingRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "uuid" })
  requesterId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "requesterId", referencedColumnName: "user_id" })
  requester!: User;

  @Column({ type: "uuid" })
  receiverId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "receiverId", referencedColumnName: "user_id" })
  receiver!: User;

  @Column({ type: "int" })
  busId!: number;

  @Column({
    type: "enum",
    enum: TrackingRequestStatus,
    default: TrackingRequestStatus.PENDING,
  })
  status!: TrackingRequestStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: "datetime", nullable: true })
  expiresAt!: Date | null;
}
