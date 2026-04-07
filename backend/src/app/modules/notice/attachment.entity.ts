import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Notice } from "./notice.entity";

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Notice, (notice) => notice.attachments, {
    onDelete: "CASCADE",
  })
  notice!: Notice;

  @Column()
  fileName!: string;

  @Column()
  filePath!: string;

  @Column()
  fileType!: string; // mime type

  @Column()
  fileSize!: number; // in bytes

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
