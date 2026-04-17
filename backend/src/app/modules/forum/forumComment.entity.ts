import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";
import { ForumPost } from "./forumPost.entity";

@Entity("forum_comments")
export class ForumComment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  content!: string;

  @ManyToOne(() => ForumPost, (post) => post.comments, { onDelete: "CASCADE" })
  post!: ForumPost;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  author!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
