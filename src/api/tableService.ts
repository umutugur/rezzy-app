// src/api/tableService.ts
import { api } from "./client";
import { normalizeMongoId } from "./restaurants";

export type TableServiceRequestPayload = {
  restaurantId: string;
  tableId?: string | null;
  sessionId?: string | null;
  type: "waiter" | "bill";
};

export async function createTableServiceRequest(
  payload: TableServiceRequestPayload
) {
  const body = {
    restaurantId: normalizeMongoId(payload.restaurantId),
    tableId: payload.tableId || undefined,
    sessionId: payload.sessionId || undefined,
    type: payload.type,
  };

  const res = await api.post("/table-service/requests", body);
  return res.data;
}