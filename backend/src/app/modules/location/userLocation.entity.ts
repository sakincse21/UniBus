import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, UpdateDateColumn } from "typeorm";
import { User } from "../user/user.entity";

@Entity("user_locations")
export class UserLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column("double")
  lat!: number;

  @Column("double")
  lng!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
