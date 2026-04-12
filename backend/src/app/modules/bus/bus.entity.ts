import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("buses")
export class Bus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  busNumber!: string;
}
