import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { User } from "../user/user.entity";

@Entity("batches")
export class Batch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string; // "2021", "2022"

  @OneToMany(() => User, (user) => user.batch)
  students!: User[];
}