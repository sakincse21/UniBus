import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Batch } from "../batch/batch.entity";
import { User } from "../user/user.entity";
import { ForumComment } from "./forumComment.entity";

@Entity("forum_posts")
export class ForumPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 180 })
  title!: string;

  @Column("text")
  content!: string;

  @ManyToOne(() => Batch, { onDelete: "CASCADE" })
  batch!: Batch;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  author!: User;

  @OneToMany(() => ForumComment, (comment) => comment.post)
  comments!: ForumComment[];

  // Populated via query-builder relation count mapping.
  commentCount?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
