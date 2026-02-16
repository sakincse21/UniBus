import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from "typeorm";
import { Bus } from "../bus/bus.entity";
import { Route } from "../route/route.entity";

@Entity("bus_schedules")
export class BusSchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Bus)
  bus!: Bus;

  @ManyToOne(() => Route)
  route!: Route;

  @Column()
  startTime!: string; // "07:30:00"

  @Column()
  endTime!: string;
}
