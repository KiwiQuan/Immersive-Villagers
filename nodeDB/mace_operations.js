import { readItem } from "#BP/scripts/main";
import { getAllRows } from "#db/queries/queries";
export const maceRead = async () => {
  if (readItem.name === "read") {
    const rows = await getAllRows();
    return rows;
  }
};
