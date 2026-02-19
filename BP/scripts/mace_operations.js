import { readItem } from "./main.js";
import { getAllRows } from "./queries.js";
export const maceRead = async () => {
  if (readItem.name === "read") {
    const rows = await getAllRows();
    return rows;
  }
};
