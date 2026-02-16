import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Route } from "./route.entity";

@Entity("route_points")
export class RoutePoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Route, (route) => route.points, { onDelete: "CASCADE" })
  route!: Route;

  @Column("double")
  lat!: number;

  @Column("double")
  lng!: number;

  @Column()
  sequence!: number;

  // minutes from schedule start
  @Column()
  minuteOffset!: number;
}
