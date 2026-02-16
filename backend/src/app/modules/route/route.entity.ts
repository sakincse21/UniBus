import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { RoutePoint } from "./routePoint.entity";

@Entity("routes")
export class Route {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @OneToMany(() => RoutePoint, (rp) => rp.route)
  points!: RoutePoint[];
}
