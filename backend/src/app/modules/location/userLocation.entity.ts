import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../user/user.entity";

@Entity("user_locations")
export class UserLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column("double precision")
  lat!: number;

  @Column("double precision")
  lng!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
