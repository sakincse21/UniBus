import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
} from "typeorm";
import { Bus } from "../bus/bus.entity";

@Entity("estimated_bus_locations")
export class EstimatedBusLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Bus)
  bus!: Bus;

  @Column("double")
  lat!: number;

  @Column("double")
  lng!: number;

  @Column("float")
  confidence!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
