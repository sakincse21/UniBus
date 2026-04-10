import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";
import { Batch } from "../batch/batch.entity";
import { Attachment } from "./attachment.entity";

export enum NoticeStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity("notices")
export class Notice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column("text")
  content!: string;

  @ManyToOne(() => User)
  createdBy!: User;

  @Column({
    type: "enum",
    enum: NoticeStatus,
    default: NoticeStatus.PENDING,
  })
  status!: NoticeStatus;

  @Column({ default: false })
  forAll!: boolean;

  @Column({ default: false })
  forTeachers!: boolean;

  @ManyToOne(() => Batch, { nullable: true })
  targetBatch?: Batch;

  @Column({ type: "date", nullable: true })
  eventDate?: Date;

  @Column({ type: "time", nullable: true })
  startTime?: string;

  @Column({ type: "time", nullable: true })
  endTime?: string;

  @OneToMany(() => Attachment, (attachment) => attachment.notice, {
    cascade: true,
    eager: true,
  })
  attachments?: Attachment[];

  @CreateDateColumn()
  createdAt!: Date;
}
