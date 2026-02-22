import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";
import { Batch } from "../batch/batch.entity";

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

  @CreateDateColumn()
  createdAt!: Date;
}