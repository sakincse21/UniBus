import { AppDataSource } from "../../db/data-source";
import { TrackingRequest, TrackingRequestStatus } from "./trackingRequest.entity";

class TrackingRequestRepository {
  private readonly repo = AppDataSource.getRepository(TrackingRequest);

  async findActivePendingForPair(
    requesterId: string,
    receiverId: string,
    busId: number,
    now: Date,
  ): Promise<TrackingRequest | null> {
    return this.repo
      .createQueryBuilder("request")
      .where("request.requesterId = :requesterId", { requesterId })
      .andWhere("request.receiverId = :receiverId", { receiverId })
      .andWhere("request.busId = :busId", { busId })
      .andWhere("request.status = :status", { status: TrackingRequestStatus.PENDING })
      .andWhere("(request.expiresAt IS NULL OR request.expiresAt > :now)", { now })
      .getOne();
  }

  async createPending(payload: {
    requesterId: string;
    receiverId: string;
    busId: number;
    expiresAt: Date | null;
  }): Promise<TrackingRequest> {
    const request = this.repo.create({
      requesterId: payload.requesterId,
      receiverId: payload.receiverId,
      busId: payload.busId,
      status: TrackingRequestStatus.PENDING,
      expiresAt: payload.expiresAt,
    });

    return this.repo.save(request);
  }

  async findPendingByReceiver(receiverId: string, now: Date): Promise<TrackingRequest[]> {
    return this.repo
      .createQueryBuilder("request")
      .innerJoinAndSelect("request.requester", "requester")
      .where("request.receiverId = :receiverId", { receiverId })
      .andWhere("request.status = :status", { status: TrackingRequestStatus.PENDING })
      .andWhere("(request.expiresAt IS NULL OR request.expiresAt > :now)", { now })
      .orderBy("request.createdAt", "DESC")
      .getMany();
  }

  async findByIdForReceiver(
    id: number,
    receiverId: string,
  ): Promise<TrackingRequest | null> {
    return this.repo
      .createQueryBuilder("request")
      .innerJoinAndSelect("request.requester", "requester")
      .where("request.id = :id", { id })
      .andWhere("request.receiverId = :receiverId", { receiverId })
      .getOne();
  }

  async findPendingByIdForReceiver(
    id: number,
    receiverId: string,
  ): Promise<TrackingRequest | null> {
    return this.repo
      .createQueryBuilder("request")
      .innerJoinAndSelect("request.requester", "requester")
      .where("request.id = :id", { id })
      .andWhere("request.receiverId = :receiverId", { receiverId })
      .andWhere("request.status = :status", { status: TrackingRequestStatus.PENDING })
      .getOne();
  }

  async save(request: TrackingRequest): Promise<TrackingRequest> {
    return this.repo.save(request);
  }

  async rejectOtherPendingForBus(
    requestId: number,
    requesterId: string,
    busId: number,
    now: Date,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(TrackingRequest)
      .set({ status: TrackingRequestStatus.REJECTED })
      .where("id != :requestId", { requestId })
      .andWhere("requesterId = :requesterId", { requesterId })
      .andWhere("busId = :busId", { busId })
      .andWhere("status = :status", { status: TrackingRequestStatus.PENDING })
      .andWhere("(expiresAt IS NULL OR expiresAt > :now)", { now })
      .execute();
  }
}

const trackingRequestRepo = new TrackingRequestRepository();

export default trackingRequestRepo;
