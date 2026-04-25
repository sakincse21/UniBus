import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";

@Entity("user_fixtures")
export class UserFixture {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column()
  title!: string;

  @Column("text", { nullable: true })
  description?: string;

  @Column({ type: "timestamp" })
  startDateTime!: Date;

  @Column({ type: "timestamp" })
  endDateTime!: Date;

  @Column({ type: "boolean", default: false })
  isAllDay!: boolean;

  @Column({ type: "boolean", default: false })
  isPublic!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
